// translate-articles/index.ts
// Dedicated edge function — translates untranslated articles to Arabic via Gemini
// Called by: admin panel OR daily cron (separate from fetch-news to avoid timeout)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent'

async function translateToArabic(
  title: string,
  summary: string,
  key: string
): Promise<{ title_ar: string; summary_ar: string } | null> {
  const prompt = `Translate the following news article title and summary to Arabic naturally and accurately.
Return JSON only with this exact format: {"title_ar":"...","summary_ar":"..."}
Title: ${title}
Summary: ${summary}`

  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
    }),
  })

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''

  try {
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (parsed.title_ar && parsed.summary_ar) return parsed
    return null
  } catch {
    // Try to extract with regex fallback
    const titleMatch = raw.match(/"title_ar"\s*:\s*"([^"]+)"/)
    const summaryMatch = raw.match(/"summary_ar"\s*:\s*"([^"]+)"/)
    if (titleMatch && summaryMatch) {
      return { title_ar: titleMatch[1], summary_ar: summaryMatch[1] }
    }
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Auth
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

  // Fetch up to 40 articles missing Arabic translation
  const { data: articles, error } = await supabase
    .from('articles')
    .select('url, title, summary, description')
    .is('title_ar', null)
    .not('title', 'is', null)
    .limit(40)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!articles || articles.length === 0) {
    return new Response(JSON.stringify({ success: true, translated: 0, message: 'All articles already translated' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log(`[translate-articles] Translating ${articles.length} articles to Arabic...`)

  let translated = 0
  let failed = 0
  let lastError = ''

  for (const article of articles) {
    try {
      const text = article.summary || article.description || article.title
      const result = await translateToArabic(article.title, text, GEMINI_KEY)

      if (result) {
        const { error: updateError } = await supabase
          .from('articles')
          .update({ title_ar: result.title_ar, summary_ar: result.summary_ar })
          .eq('url', article.url)

        if (updateError) {
          console.warn('[translate-articles] Update failed:', updateError.message)
          lastError = updateError.message
          failed++
        } else {
          translated++
        }
      } else {
        lastError = 'JSON parse failed'
        failed++
      }
    } catch (e: any) {
      lastError = e.message
      console.warn('[translate-articles] Translation failed for:', article.title, e.message)
      failed++
    }

    // 2s delay to respect Gemini free tier rate limit (15 RPM)
    await new Promise(r => setTimeout(r, 2000))
  }

  console.log(`[translate-articles] Done: ${translated} translated, ${failed} failed`)

  return new Response(
    JSON.stringify({ success: true, translated, failed, lastError, remaining: articles.length - translated }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
