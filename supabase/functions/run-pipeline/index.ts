// supabase/functions/run-pipeline/index.ts
// Self-pacing orchestrator: each call does the next chunk of pipeline work.
//   1. If 48h+ since the last fetch (or ?force=1) → run scheduled-fetch
//   2. Translate untranslated articles (translate-articles, repeated)
//   3. Generate missing Taitan Takes (generate-takes, repeated)
// Stops starting new work after TIME_BUDGET_MS so it stays under the edge
// function wall-clock limit; the next call picks up where this one left off.
// Called by: external cron (cron-job.org) every 15 minutes, which also keeps
// the Supabase free-tier project from pausing.
// Body { "mode": "check" } only verifies the admin key (used by /admin login).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const FETCH_INTERVAL_MS = 48 * 60 * 60 * 1000
const TIME_BUDGET_MS    = 85_000 // free tier wall clock is 150s; a generate-takes call can take ~50s
const MAX_EMPTY_ROUNDS  = 2

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const ADMIN_PASS = Deno.env.get('ADMIN_PASSWORD')
  if (!ADMIN_PASS) return json({ error: 'ADMIN_PASSWORD secret not set' }, 500)
  if (req.headers.get('x-admin-key') !== ADMIN_PASS) return json({ error: 'Unauthorized' }, 401)

  let body: any = {}
  try { body = await req.json() } catch { /* GET or empty body */ }
  if (body.mode === 'check') return json({ success: true })

  const force = new URL(req.url).searchParams.get('force') === '1' || body.force === true

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const started = Date.now()
  const timeLeft = () => Date.now() - started < TIME_BUDGET_MS

  async function callStep(name: string): Promise<any> {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'x-admin-key': ADMIN_PASS!,
      },
      body: '{}',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`${name} HTTP ${res.status}: ${data.error || 'unknown error'}`)
    return data
  }

  const summary: Record<string, unknown> = { fetched: false, stored: 0, translated: 0, takes: 0 }
  const errors: string[] = []

  // ── 1. Fetch (every 48h) ────────────────────────────────────────────────────
  const { data: lastRun } = await supabase
    .from('fetch_log')
    .select('ran_at')
    .order('ran_at', { ascending: false })
    .limit(1)

  const lastRanAt = lastRun?.[0]?.ran_at ? new Date(lastRun[0].ran_at).getTime() : 0
  if (force || Date.now() - lastRanAt >= FETCH_INTERVAL_MS) {
    try {
      const res = await callStep('scheduled-fetch')
      summary.fetched = true
      summary.stored  = res.stored ?? 0
    } catch (e: any) {
      errors.push(e.message)
    }
  }
  summary.last_fetch = new Date(summary.fetched ? Date.now() : lastRanAt).toISOString()

  // ── 2 & 3. Translate, then Takes — repeat until done or out of time ─────────
  const loops: Array<[string, string, string]> = [
    ['translate-articles', 'translated', 'All articles already translated'],
    ['generate-takes',     'generated',  'All articles already have a Taitan Take'],
  ]
  const totals = [0, 0]

  for (let s = 0; s < loops.length; s++) {
    const [name, countField, doneMessage] = loops[s]
    let emptyRounds = 0
    while (timeLeft() && emptyRounds < MAX_EMPTY_ROUNDS) {
      try {
        const res = await callStep(name)
        if (res.message === doneMessage) break
        const n = res[countField] ?? 0
        totals[s] += n
        if (n === 0) {
          emptyRounds++
          if (res.lastError) errors.push(`${name}: ${res.lastError}`)
        } else {
          emptyRounds = 0
        }
      } catch (e: any) {
        errors.push(e.message)
        emptyRounds++
      }
    }
  }
  summary.translated = totals[0]
  summary.takes      = totals[1]

  // ── Remaining work, so callers can see whether another run is needed ────────
  const [{ count: pendingAr }, { count: pendingTakes }] = await Promise.all([
    supabase.from('articles').select('*', { count: 'exact', head: true }).is('title_ar', null),
    supabase.from('articles').select('*', { count: 'exact', head: true }).is('taitan_take', null),
  ])
  summary.pending_translation = pendingAr ?? 0
  summary.pending_takes       = pendingTakes ?? 0
  summary.elapsed_s           = Math.round((Date.now() - started) / 1000)
  if (errors.length) summary.errors = errors

  console.log('[run-pipeline]', JSON.stringify(summary))
  return json({ success: errors.length === 0, ...summary })
})
