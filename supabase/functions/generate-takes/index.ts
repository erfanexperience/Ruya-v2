// supabase/functions/generate-takes/index.ts
// Generates Taitan Takes server-side for articles missing one.
// Called by: admin panel or daily cron. Processes 3 articles per call.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Condensed prompt — same voice and constraints, half the tokens
const SYSTEM_PROMPT = `You are a senior business strategist fluent in Saudi Arabia and Silicon Valley. Write a TAITAN TAKE — a single paragraph of strategic analysis for a news article. This is NOT a summary. It explains what a sophisticated global reader is most likely to miss or undersize about the article, read through the lens of Taitan Global (the firm that brings the best American companies to Saudi Arabia).

SAUDI FACTS — cite at least one:
- Saudi GDP ~$1.07T (2024), G20, ~17th largest globally
- PIF (Public Investment Fund) ~$925B AUM, target $2T by 2030
- HUMAIN: PIF's AI champion, 18,000 Nvidia Blackwell GPUs, launched May 2025
- Vision 2030: launched 2016, diversification from oil; giga-projects include NEOM, The Line, Qiddiya, Red Sea Global, Diriyah Gate, AlUla
- Capital moves faster than US institutional cycles — billion-dollar decisions in weeks
- Women's workforce participation: 17% (2017) to 36%+ (2024)
- Riyadh: 7-8M population, growing to 15M by 2030
- 2034 FIFA World Cup host, Expo 2030, F1, LIV Golf

OUTPUT RULES — follow exactly:
- ONE paragraph only. No headings, bullets, or line breaks.
- 120 to 180 words. 5 to 7 sentences.
- Open with the strategic frame, NOT "This article is about..."
- Close with the US-to-Saudi bridge: what this means for American operators entering Saudi Arabia
- Voice: confident, evidence-led strategist. No hype, no emoji.
- No regional framing ("For Western readers...", "In the US...")
- Return ONLY the paragraph. No preamble, no labels, no notes.`

const GEMINI_MODELS = [
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
]

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function callGemini(prompt: string, key: string): Promise<string> {
  let lastErr = 'no attempt made'
  for (const modelUrl of GEMINI_MODELS) {
    const modelName = modelUrl.split('/models/')[1]?.split(':')[0] || modelUrl
    try {
      const res = await fetch(`${modelUrl}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
        }),
      })
      if (res.status === 429 || res.status === 503) {
        lastErr = `${modelName}: rate limited (${res.status})`
        await sleep(2000)
        continue
      }
      if (!res.ok) {
        const errText = await res.text()
        lastErr = `${modelName} HTTP ${res.status}: ${errText.slice(0, 300)}`
        console.warn(`[generate-takes] ${lastErr}`)
        continue
      }
      const data = await res.json()
      const candidate = data?.candidates?.[0]
      const finishReason = candidate?.finishReason || 'UNKNOWN'
      const text = candidate?.content?.parts?.[0]?.text?.trim() || ''
      if (text) {
        console.log(`[generate-takes] ${modelName} OK — ${text.length} chars, finish: ${finishReason}`)
        return text
      }
      lastErr = `${modelName}: empty response (finish: ${finishReason})`
      console.warn(`[generate-takes] ${lastErr}`)
    } catch (e: any) {
      lastErr = `${modelName}: network error — ${e.message}`
      console.warn(`[generate-takes] ${lastErr}`)
    }
  }
  throw new Error(lastErr)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const adminKey   = req.headers.get('x-admin-key')
  const ADMIN_PASS = Deno.env.get('ADMIN_PASSWORD') || 'Taitan12@@4'
  if (adminKey !== ADMIN_PASS) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const GEMINI_KEY = Deno.env.get('GEMINI_KEY') || ''
  if (!GEMINI_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_KEY not set' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: articles, error } = await supabase
    .from('articles')
    .select('url, title, description, summary')
    .is('taitan_take', null)
    .not('title', 'is', null)
    .limit(3)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!articles || articles.length === 0) {
    return new Response(
      JSON.stringify({ success: true, generated: 0, message: 'All articles already have a Taitan Take' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`[generate-takes] Generating Takes for ${articles.length} articles...`)

  let generated = 0
  let failed = 0
  let lastError = ''

  for (const article of articles) {
    try {
      const fullPrompt = `${SYSTEM_PROMPT}\n\nWrite the Taitan Take for the article below. Return only the paragraph.\n\nARTICLE:\nTitle: ${article.title}\n${article.description ? `Content: ${article.description}` : ''}`
      const take = await callGemini(fullPrompt, GEMINI_KEY)

      if (take && take.length >= 200) {
        const { error: updateErr } = await supabase
          .from('articles')
          .update({ taitan_take: take })
          .eq('url', article.url)

        if (updateErr) {
          lastError = `DB: ${updateErr.message}`
          failed++
        } else {
          generated++
          console.log(`[generate-takes] OK "${article.title.slice(0, 50)}" (${take.length} chars)`)
        }
      } else if (take) {
        lastError = `Take too short (${take.length} chars): "${take.slice(0, 80)}"`
        console.warn(`[generate-takes] Rejected: ${lastError}`)
        failed++
      } else {
        lastError = 'Empty response'
        failed++
      }
    } catch (e: any) {
      lastError = e.message
      console.warn(`[generate-takes] Failed: ${e.message}`)
      failed++
    }

    await sleep(4000)
  }

  return new Response(
    JSON.stringify({ success: true, generated, failed, lastError }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
