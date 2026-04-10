// scheduled-fetch/index.ts
// Called by Supabase cron schedule — no auth needed (internal call)
// Triggers fetch-news then translate-articles in sequence

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
  const ADMIN_PASSWORD   = Deno.env.get('ADMIN_PASSWORD') || 'Taitan12@@4'

  console.log('[scheduled-fetch] Starting daily fetch pipeline...')

  try {
    // Step 1: Fetch news
    console.log('[scheduled-fetch] Calling fetch-news...')
    const fetchRes = await fetch(`${SUPABASE_URL}/functions/v1/fetch-news`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_PASSWORD },
      body: JSON.stringify({}),
    })
    const fetchData = await fetchRes.json()
    console.log('[scheduled-fetch] fetch-news result:', JSON.stringify(fetchData))

    // Step 2: Translate to Arabic (run twice to cover more articles)
    for (let i = 0; i < 2; i++) {
      console.log(`[scheduled-fetch] Calling translate-articles (pass ${i + 1})...`)
      const translateRes = await fetch(`${SUPABASE_URL}/functions/v1/translate-articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_PASSWORD },
        body: JSON.stringify({}),
      })
      const translateData = await translateRes.json()
      console.log(`[scheduled-fetch] translate-articles pass ${i + 1}:`, JSON.stringify(translateData))

      if (translateData.remaining === 0) break
      await new Promise(r => setTimeout(r, 3000))
    }

    return new Response(JSON.stringify({ success: true, fetch: fetchData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('[scheduled-fetch] Error:', e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
