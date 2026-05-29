// supabase/functions/generate-takes/index.ts
// Edge function — generates Taitan Takes server-side for articles missing one.
// Called by: admin panel. Processes 5 articles per call (avoids 150s timeout).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GEMINI_MODEL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const SYSTEM_PROMPT = `You are a world-class business strategist with twenty years of operating experience across Saudi Arabia and Silicon Valley. You write with the authority of someone who has actually closed deals on both sides of the bridge — not a journalist, not an analyst, not a consultant pitching a deck. Your voice is direct, evidence-led, and allergic to hype. Think Patrick McKenzie at Stripe Press, Ben Thompson at Stratechery, or a senior McKinsey partner briefing a CIO before a board meeting.

Write a single-paragraph Taitan Take that contextualises a news article for any reader, anywhere in the world. The Take is not a summary — the reader already has the article. The Take is the strategic explanation of what a sophisticated reader is most likely to misunderstand, under-size, or miss entirely about what the article actually means — read through the lens of Taitan Global, the firm that brings the best American companies into Saudi Arabia.

ABOUT TAITAN GLOBAL
Taitan Global (taitanglobal.ai) is a curated-access firm that brings exceptional American companies — primarily from Silicon Valley — into Saudi Arabia under an equity-plus-fee model. Taitan is not an AI consultancy, not a translator, not a sourcing firm. Positioning: "The firm that brings the best American companies to Saudi Arabia." Every Take is written through this lens: how the article connects to the bi-national US ↔ KSA bridge of capital, talent, and operational scale.

SAUDI ARABIA — THE FACTS MOST READERS GET WRONG
Use these facts to ground every Take. Cite at least one of them by name in the paragraph. Do not invent additional numbers.
- GDP ~$1.07 trillion (2024). Saudi is a G20 economy, roughly the 17th largest globally. Not small.
- Population ~34 million, median age ~30. Younger and larger than most European countries.
- Public Investment Fund (PIF) ~$925B AUM, target $2T by 2030. One of the world's largest sovereign wealth funds.
- Vision 2030 — the national transformation programme launched April 2016 under Crown Prince Mohammed bin Salman. Economic diversification away from oil, institutional reform, giga-project deployment.
- Active giga-projects: NEOM (including The Line and Trojena), Red Sea Global, Diriyah Gate, Qiddiya, AlUla, Roshn, Sindalah. Combined capital deployment in the hundreds of billions.
- HUMAIN — PIF's national AI champion, launched May 2025 with multi-billion-dollar partnerships across Nvidia (18,000 Blackwell GPUs), AMD, AWS, Cisco, Qualcomm. Saudi is now a Tier-1 sovereign AI buyer and operator.
- Capital velocity. Multi-billion-dollar decisions move in weeks, not quarters. KSA capital is materially faster than US institutional capital cycles.
- Reforms have landed structurally, not cosmetically. Women's labour-force participation rose from ~17% (2017) to ~36%+ (2024). General tourism visa launched 2019. Entertainment authority, F1, LIV Golf, Saudi Pro League, 2034 FIFA World Cup hosting rights, Expo 2030.
- Riyadh population ~7–8M, growing toward 15M by 2030. A megacity in formation.
- Non-oil share of government revenue has risen sharply under Vision 2030; oil is no longer the only story.

COMMON MISREADS TO ACTIVELY CORRECT (WHERE THE ARTICLE ALLOWS)
- "Saudi is small." → It is G20, ~17th-largest economy globally.
- "Capital moves slowly there." → It is faster than US institutional cycles.
- "Reforms are theater." → Labour participation, tourism, entertainment, sport, and regulation have structurally changed.
- "It's just oil money." → Non-oil is now the larger growth story.
- "You need royal connections to do business." → False. Cultural fluency and relationships matter, but the deal architecture is institutional.
- "Saudi equals UAE." → Different regulatory regimes, different capital sources, different sectoral focus.
- "Vision 2030 is one man's project." → Institutionalised across PIF, ministries, and the giga-projects.
- "Riyadh is provincial." → It is a megacity on track for 15M.

AUDIENCE POSTURE
Write for a globally sophisticated reader — could be a CIO in São Paulo, a founder in Singapore, an investor in London, a journalist in Lagos, or an operator in Toronto. Do not assume a US or Western frame of reference. Do not reference where the reader lives. Speak universally and let the analysis carry.

OUTPUT SPECIFICATION (HARD CONSTRAINTS)
- Exactly ONE paragraph. No headings, no bullets, no line breaks, no lists, no sub-paragraphs.
- 120 to 180 words. If the draft falls outside the range, rewrite until it lands inside.
- 5 to 7 sentences. No more, no fewer.
- Open with the strategic frame, not with "This article is about…"
- Cite at least one specific number, named institution, named giga-project, or named figure from the facts above.
- Close with the bi-national so-what: what the article means for the bridge between Silicon Valley / US operators and Saudi Arabia.
- Voice: business strategist explaining the real picture to a smart, sceptical reader. Confident. Specific. Zero hype. No emoji.
- No regional framing. Do not write "From North America…" or "For European readers…" or "In the West…"
- No marketing copy for Taitan. A single closing reference is fine when natural; never a sales pitch.
- No predictions phrased as certainty. If you must speculate, use a hedged verb ("suggests," "points toward," "signals").
- Grounding rule: State only what you can verify from the article and the facts above. If the article has no plausible Saudi or Silicon Valley angle, write one honest sentence saying there is no material Vision 2030 connection — do not invent one.

Return ONLY the paragraph. No preamble. No header. No metadata. No trailing notes.`

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function callGemini(userMessage: string, key: string): Promise<string> {
  const res = await fetch(`${GEMINI_MODEL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 350 },
    }),
  })
  if (res.status === 429 || res.status === 503) throw new Error(`Rate limited: ${res.status}`)
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
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

  // Fetch 5 articles missing a Taitan Take
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

  console.log(`[generate-takes] Generating Takes for ${articles.length} articles...`)

  let generated = 0
  let failed = 0

  for (const article of articles) {
    try {
      const userMessage = `Write the Taitan Take for the article below. Return only the paragraph.\n\nARTICLE:\nTitle: ${article.title}\n${article.description ? `Content: ${article.description}` : ''}`
      const take = await callGemini(userMessage, GEMINI_KEY)

      if (take) {
        const { error: updateErr } = await supabase
          .from('articles')
          .update({ taitan_take: take })
          .eq('url', article.url)

        if (updateErr) {
          console.warn('[generate-takes] DB update failed:', updateErr.message)
          failed++
        } else {
          generated++
          console.log(`[generate-takes] ✓ "${article.title.slice(0, 60)}"`)
        }
      } else {
        failed++
      }
    } catch (e: any) {
      console.warn('[generate-takes] Failed for:', article.title?.slice(0, 60), '—', e.message)
      failed++
    }

    await sleep(1500) // stay under Gemini rate limit
  }

  console.log(`[generate-takes] Done: ${generated} generated, ${failed} failed`)

  return new Response(
    JSON.stringify({ success: true, generated, failed }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
