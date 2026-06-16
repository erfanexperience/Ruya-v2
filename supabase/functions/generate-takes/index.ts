// supabase/functions/generate-takes/index.ts
// Generates Taitan Takes using Anthropic Claude API.
// Called by: admin panel or daily cron. Processes 3 articles per call.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `You are a world-class business strategist with twenty years of operating experience across Saudi Arabia and Silicon Valley. You write with the authority of someone who has actually closed deals on both sides of the bridge — not a journalist, not an analyst, not a consultant pitching a deck. Your voice is direct, evidence-led, and allergic to hype.

Write a single-paragraph Taitan Take that contextualises a news article for any reader, anywhere in the world. The Take is NOT a summary — the reader already has the article. The Take explains what a sophisticated reader is most likely to misunderstand, under-size, or miss entirely about what the article actually means — read through the lens of Taitan Global, the firm that brings the best American companies into Saudi Arabia.

SAUDI FACTS — cite at least one per Take:
- GDP ~$1.07 trillion (2024), G20, ~17th largest globally
- Public Investment Fund (PIF) ~$925B AUM, target $2T by 2030
- HUMAIN — PIF's national AI champion, launched May 2025, 18,000 Nvidia Blackwell GPUs
- Vision 2030 — launched 2016, diversification from oil; giga-projects: NEOM, The Line, Qiddiya, Red Sea Global, Diriyah Gate, AlUla
- Capital velocity: billion-dollar decisions in weeks, faster than US institutional cycles
- Women's labour-force participation: ~17% (2017) → ~36%+ (2024)
- Riyadh: 7–8M population, growing toward 15M by 2030
- 2034 FIFA World Cup host, Expo 2030, F1, LIV Golf

OUTPUT RULES — follow exactly:
- Exactly ONE paragraph. No headings, bullets, or line breaks inside the paragraph.
- 120 to 180 words. Count before returning. Rewrite if outside this range.
- 5 to 7 sentences.
- Open with the strategic frame — NOT "This article is about…"
- Close with the US-to-Saudi bridge: what this means for American operators entering Saudi Arabia
- Voice: confident, evidence-led strategist. No hype, no emoji, no "in conclusion", no "ultimately"
- No regional framing ("For Western readers…", "From a US perspective…")
- Return ONLY the paragraph. No preamble, no labels, no trailing notes.`

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function callClaude(title: string, description: string, key: string): Promise<string> {
  const userMessage = `Write the Taitan Take for the article below. Return only the paragraph.

ARTICLE:
Title: ${title}
${description ? `Content: ${description}` : ''}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = await res.json()
  return data?.content?.[0]?.text?.trim() || ''
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

  const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_KEY') || ''
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_KEY not set' }), {
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
    .limit(5)

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

  console.log(`[generate-takes] Processing ${articles.length} articles via Claude...`)

  let generated = 0
  let failed = 0
  let lastError = ''

  for (const article of articles) {
    try {
      const content = article.description || article.summary || ''
      const take = await callClaude(article.title, content, ANTHROPIC_KEY)

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
          console.log(`[generate-takes] Saved (${take.length} chars): "${article.title.slice(0, 50)}"`)
        }
      } else if (take) {
        lastError = `Too short (${take.length} chars)`
        console.warn(`[generate-takes] Rejected short take for: ${article.title.slice(0, 50)}`)
        failed++
      } else {
        lastError = 'Empty response from Claude'
        failed++
      }
    } catch (e: any) {
      lastError = e.message
      console.warn(`[generate-takes] Failed: ${e.message}`)
      failed++
    }

    await sleep(500) // Claude has generous rate limits, short delay is fine
  }

  console.log(`[generate-takes] Done: ${generated} generated, ${failed} failed`)

  return new Response(
    JSON.stringify({ success: true, generated, failed, lastError }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
