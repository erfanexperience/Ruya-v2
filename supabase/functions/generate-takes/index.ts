// supabase/functions/generate-takes/index.ts
// Generates Taitan Takes server-side for articles missing one.
// Called by: admin panel or daily cron. Processes 3 articles per call.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Single-call prompt — no system/user split, minimal tokens, full output
function buildPrompt(title: string, description: string): string {
  return `Write a Taitan Take: a single paragraph (exactly 120-180 words, 5-7 sentences) of strategic business analysis for this Saudi tech news article. You are a senior business strategist. Rules: (1) NOT a summary — explain what sophisticated readers miss. (2) Cite at least one: Saudi GDP ~$1.07T, PIF ~$925B AUM, Vision 2030, NEOM, HUMAIN, Riyadh growing to 15M. (3) Close with what this means for US companies entering Saudi Arabia. (4) Voice: direct, evidence-led, zero hype. (5) Return ONLY the paragraph, no labels or preamble.

Title: ${title}
${description ? `Context: ${description}` : ''}`
}

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

  console.log(`[generate-takes] Processing ${articles.length} articles...`)

  let generated = 0
  let failed = 0
  let lastError = ''

  for (const article of articles) {
    try {
      const content = article.description || article.summary || ''
      const prompt = buildPrompt(article.title, content)
      const take = await callGemini(prompt, GEMINI_KEY)

      // Accept anything over 80 chars — log quality for monitoring
      if (take && take.length >= 80) {
        const { error: updateErr } = await supabase
          .from('articles')
          .update({ taitan_take: take })
          .eq('url', article.url)

        if (updateErr) {
          lastError = `DB: ${updateErr.message}`
          failed++
        } else {
          generated++
          console.log(`[generate-takes] Saved (${take.length} chars): "${article.title.slice(0, 50)}"`)
        }
      } else if (take) {
        lastError = `Too short (${take.length} chars): "${take.slice(0, 60)}"`
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
