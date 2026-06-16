// supabase/functions/translate-articles/index.ts
// Translates articles to Arabic using Anthropic Claude API.
// Called by: admin panel or daily cron. Processes 5 articles per call.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function translateToArabic(
  title: string,
  summary: string,
  key: string
): Promise<{ title_ar: string; summary_ar: string } | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Translate the following to Arabic naturally and accurately. Reply with exactly 2 lines:
Line 1: the translated title
Line 2: the translated summary
Do not add labels, numbers, or any other text.

Title: ${title}
Summary: ${summary}`,
      }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const raw = data?.content?.[0]?.text?.trim() || ''
  if (!raw) return null

  const lines = raw.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)

  if (lines.length >= 2) {
    return { title_ar: lines[0], summary_ar: lines.slice(1).join(' ') }
  }
  if (lines.length === 1) {
    return { title_ar: lines[0], summary_ar: lines[0] }
  }
  return null
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
    .select('url, title, summary, description')
    .is('title_ar', null)
    .not('title', 'is', null)
    .limit(5)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!articles || articles.length === 0) {
    return new Response(
      JSON.stringify({ success: true, translated: 0, message: 'All articles already translated' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`[translate-articles] Translating ${articles.length} articles via Claude...`)

  let translated = 0
  let failed = 0
  let lastError = ''

  for (const article of articles) {
    try {
      const text = article.summary || article.description || article.title
      const result = await translateToArabic(article.title, text, ANTHROPIC_KEY)

      if (result) {
        const { error: updateError } = await supabase
          .from('articles')
          .update({ title_ar: result.title_ar, summary_ar: result.summary_ar })
          .eq('url', article.url)

        if (updateError) {
          lastError = updateError.message
          failed++
        } else {
          translated++
        }
      } else {
        lastError = 'Empty response'
        failed++
      }
    } catch (e: any) {
      lastError = e.message
      console.warn(`[translate-articles] Failed: ${e.message}`)
      failed++
    }

    await sleep(300)
  }

  console.log(`[translate-articles] Done: ${translated} translated, ${failed} failed`)

  return new Response(
    JSON.stringify({ success: true, translated, failed, lastError }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
