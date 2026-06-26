// supabase/functions/scheduled-fetch/index.ts
// Fetches tech news from all sources, filters, deduplicates, and stores in Supabase.
// Called by: admin panel "Force Full Refresh", "Run Full Pipeline" Step 1, GitHub Actions.
// Returns: { success, raw, stored, ai_tagged }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── RSS Setup ─────────────────────────────────────────────────────────────────

const RSS_PROXY = 'https://api.rss2json.com/v1/api.json?rss_url='

const RSS_FEEDS = [
  { url: 'https://www.arabnews.com/rss.xml',         source: 'Arab News' },
  { url: 'https://techcrunch.com/feed/',             source: 'TechCrunch' },
  { url: 'https://www.theverge.com/rss/index.xml',   source: 'The Verge' },
  { url: 'https://www.technologyreview.com/feed/',   source: 'MIT Tech Review' },
]

// ── Query Lists ───────────────────────────────────────────────────────────────

const NEWSAPI_QUERIES: Array<[string, string | null]> = [
  ['Saudi Arabia technology innovation 2025',              null],
  ['Saudi digital economy transformation',                 null],
  ['Saudi Arabia tech investment 2025',                    null],
  ['Vision 2030 technology digital Saudi Arabia',          'Vision 2030'],
  ['Saudi Arabia Vision 2030 innovation investment',       'Vision 2030'],
  ['Saudi economic diversification technology reform',     'Vision 2030'],
  ['Saudi national transformation plan technology',        'Vision 2030'],
  ['MBS Saudi Arabia modernization technology',            'Vision 2030'],
  ['Saudi Arabia artificial intelligence AI 2025',         'AI & Robotics'],
  ['Saudi robotics automation machine learning',           'AI & Robotics'],
  ['SDAIA artificial intelligence Saudi Arabia',           'AI & Robotics'],
  ['Saudi AI strategy national plan',                      'AI & Robotics'],
  ['Middle East AI robotics investment 2025',              'AI & Robotics'],
  ['NEOM technology smart city project Saudi',             'NEOM & Giga Projects'],
  ['Saudi giga projects NEOM Red Sea Diriyah Qiddiya',     'NEOM & Giga Projects'],
  ['The Line NEOM Saudi Arabia construction',              'NEOM & Giga Projects'],
  ['Sindalah Oxagon Trojena Saudi NEOM',                   'NEOM & Giga Projects'],
  ['Saudi Arabia startup funding fintech 2025',            'Startups'],
  ['Saudi venture capital tech startup investment',        'Startups'],
  ["STV Wa'ed Sanabil Saudi startup fund",                 'Startups'],
  ['Saudi fintech edtech healthtech startup',              'Startups'],
  ['MENA startup ecosystem Saudi funding',                 'Startups'],
  ['Saudi Arabia cybersecurity cyber attack 2025',         'Cybersecurity'],
  ['Middle East cybersecurity Saudi technology',           'Cybersecurity'],
  ['NCA Saudi Arabia national cybersecurity authority',    'Cybersecurity'],
  ['Saudi Arabia data protection privacy security',        'Cybersecurity'],
  ['Saudi Arabia 5G network telecom STC Mobily 2025',      'Telecom & 5G'],
  ['Saudi broadband fiber internet connectivity',          'Telecom & 5G'],
  ['STC Saudi Telecom 5G expansion network',               'Telecom & 5G'],
  ['Saudi Arabia digital infrastructure connectivity',     'Telecom & 5G'],
  ['Saudi Arabia gaming esports Savvy Games 2025',         'Gaming & Entertainment'],
  ['Saudi entertainment technology PIF gaming fund',       'Gaming & Entertainment'],
  ['Riyadh gaming esports tournament Saudi',               'Gaming & Entertainment'],
  ['Saudi Arabia metaverse entertainment technology',      'Gaming & Entertainment'],
]

const GNEWS_QUERIES: Array<[string, string | null]> = [
  ['Saudi Arabia technology',                  null],
  ['Vision 2030 Saudi digital economy',        'Vision 2030'],
  ['Saudi Arabia AI artificial intelligence',  'AI & Robotics'],
  ['NEOM Saudi smart city project',            'NEOM & Giga Projects'],
  ['Saudi startup fintech investment',         'Startups'],
  ['Saudi cybersecurity data security',        'Cybersecurity'],
  ['Saudi 5G telecom STC network',             'Telecom & 5G'],
  ['Saudi gaming esports entertainment',       'Gaming & Entertainment'],
  ['Saudi Arabia innovation tech 2025',        null],
  ['PIF Saudi investment technology',          null],
]

const THENEWSAPI_QUERIES: Array<[string, string | null, string]> = [
  ['Saudi Arabia technology',                      null,                    'tech'],
  ['Vision 2030 Saudi technology reform',          'Vision 2030',           'tech'],
  ['Saudi artificial intelligence SDAIA',          'AI & Robotics',         'tech'],
  ['NEOM Saudi Arabia giga project',               'NEOM & Giga Projects',  'tech'],
  ['Saudi Arabia startup venture capital',         'Startups',              'tech'],
  ['Saudi cybersecurity NCA security',             'Cybersecurity',         'tech'],
  ['Saudi Arabia 5G STC Mobily telecom',           'Telecom & 5G',          'tech'],
  ['Saudi gaming esports Savvy',                   'Gaming & Entertainment', 'tech'],
  ['Saudi Arabia digital transformation',          null,                    'tech'],
  ['Middle East technology innovation',            null,                    'tech'],
]

const WORLDNEWS_QUERIES: Array<[string, string | null]> = [
  ['Saudi Arabia technology digital',               null],
  ['Saudi Arabia artificial intelligence AI',       'AI & Robotics'],
  ['NEOM project Saudi Arabia giga',                'NEOM & Giga Projects'],
  ['Saudi startup technology investment',           'Startups'],
  ['Saudi cybersecurity security breach',           'Cybersecurity'],
  ['Saudi Arabia 5G telecom STC Mobily',            'Telecom & 5G'],
  ['Saudi gaming entertainment esports',            'Gaming & Entertainment'],
  ['Vision 2030 Saudi Arabia reform',               'Vision 2030'],
  ['Saudi Arabia innovation technology',            null],
]

// ── Filter Lists ──────────────────────────────────────────────────────────────

const BLOCKLIST = [
  'cricket', 'ipl ', ' ipl', 'football coach', 'soccer match', 'rugby', 'tennis match',
  'golf tournament', 'basketball', 'baseball', 'nba ', 'nfl ', 'premier league',
  'batting', 'bowling', 'wicket', 'scored a century',
  'election', 'polling booth', 'campaign trail', 'constituency',
  'lok sabha', 'rajya sabha', 'west bengal', 'india poll', 'modi ', 'bjp ',
  'bollywood', 'film release', 'box office', 'actor arrested',
  'recipe', 'travel tips', 'hotel review', 'horoscope', 'astrology',
  'weather forecast', 'traffic update', 'real estate price', 'property price',
]

const TECH_KEYWORDS = [
  'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
  'chatgpt', 'openai', 'gemini', 'llm', 'generative ai', 'large language model',
  'robotics', 'autonomous system', 'self-driving',
  'cybersecurity', 'cyberattack', 'ransomware', 'malware', 'data breach',
  'semiconductor', 'microchip', 'processor', 'gpu chip',
  'smartphone', 'mobile technology', 'wearable technology',
  '5g network', '6g technology', 'broadband fiber', 'satellite internet', 'telecom infrastructure',
  'electric vehicle technology', 'drone technology', 'autonomous vehicle',
  'blockchain technology', 'cryptocurrency exchange', 'bitcoin technology', 'quantum computing',
  'cloud computing', 'data center', 'software platform', 'mobile application',
  'tech startup', 'venture capital fund', 'series a funding', 'series b funding', 'funding round',
  'fintech', 'edtech', 'healthtech', 'biotech', 'cleantech',
  'neom', 'vision 2030', 'sdaia', 'smart city technology', 'giga project', 'digital transformation',
  'nvidia', 'openai', 'deepmind', 'anthropic', 'huawei technology', 'qualcomm', 'spacex',
  'technology company', 'tech company', 'software company',
  'digital economy', 'innovation hub', 'tech ecosystem',
  'augmented reality', 'virtual reality', 'metaverse', 'internet of things',
  '3d printing', 'open source software', 'developer platform',
  'esports', 'gaming technology', 'video game development',
  'savvy games', 'qiddiya', 'sindalah', 'the line',
]

const SAUDI_KEYWORDS = [
  'saudi', 'riyadh', 'jeddah', 'mecca', 'medina', 'ksa',
  'neom', 'vision 2030', 'aramco', 'stc', 'mobily', 'sdaia', 'citc',
  'gulf', 'middle east', 'arab world', 'mena',
  'uae', 'dubai', 'abu dhabi', 'qatar', 'kuwait', 'bahrain', 'oman',
  'savvy games', 'pif', 'saudi telecom', 'saudi digital',
  'saudi government', 'saudi ministry', 'saudi authority',
]

const PURE_TECH_SOURCES = ['TechCrunch', 'The Verge', 'MIT Tech Review']

// ── Types ─────────────────────────────────────────────────────────────────────

interface Article {
  url:             string
  title:           string
  description:     string
  image:           string | null
  published_at:    string | null
  source:          string
  source_priority: string
  tag:             string | null
  summary:         string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d.toISOString()
  } catch {
    return null
  }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '')
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeRSSItem(item: any, source: string): Article {
  const desc = item.description ? stripHtml(item.description).slice(0, 400) : ''
  return {
    url:             item.link || item.guid || '',
    title:           item.title || '',
    description:     desc,
    image:           item.enclosure?.link || item.thumbnail || null,
    published_at:    safeDate(item.pubDate || item.published),
    source,
    source_priority: 'rss',
    tag:             null,
    summary:         desc,
  }
}

function normalizeNewsAPI(article: any, preTag: string | null): Article {
  const desc = (article.description || article.content || '').slice(0, 400)
  return {
    url:             article.url || '',
    title:           article.title || '',
    description:     desc,
    image:           article.urlToImage || null,
    published_at:    safeDate(article.publishedAt),
    source:          article.source?.name || 'NewsAPI',
    source_priority: 'newsapi',
    tag:             preTag,
    summary:         desc,
  }
}

function normalizeGNews(article: any, preTag: string | null): Article {
  const desc = (article.description || '').slice(0, 400)
  return {
    url:             article.url || '',
    title:           article.title || '',
    description:     desc,
    image:           article.image || null,
    published_at:    safeDate(article.publishedAt),
    source:          article.source?.name || 'GNews',
    source_priority: 'gnews',
    tag:             preTag,
    summary:         desc,
  }
}

function normalizeTheNewsAPI(article: any, preTag: string | null): Article {
  const desc = (article.description || article.snippet || '').slice(0, 400)
  return {
    url:             article.url || '',
    title:           article.title || '',
    description:     desc,
    image:           article.image_url || null,
    published_at:    safeDate(article.published_at),
    source:          article.source || 'TheNewsAPI',
    source_priority: 'thenewsapi',
    tag:             preTag,
    summary:         desc,
  }
}

function normalizeWorldNews(article: any, preTag: string | null): Article {
  const desc = (article.text || article.summary || '').slice(0, 400)
  return {
    url:             article.url || '',
    title:           article.title || '',
    description:     desc,
    image:           article.image || null,
    published_at:    safeDate(article.publish_date),
    source:          'World News',
    source_priority: 'worldnews',
    tag:             preTag,
    summary:         desc,
  }
}

// ── Filter ────────────────────────────────────────────────────────────────────

function passesFilter(article: Article): boolean {
  if (!article.url || !article.title) return false
  const text = ` ${article.title} ${article.description} `.toLowerCase()
  if (BLOCKLIST.some(kw => text.includes(kw))) return false
  if (article.tag) {
    return TECH_KEYWORDS.some(kw => text.includes(kw)) || SAUDI_KEYWORDS.some(kw => text.includes(kw))
  }
  if (!TECH_KEYWORDS.some(kw => text.includes(kw))) return false
  if (!PURE_TECH_SOURCES.includes(article.source)) {
    if (!SAUDI_KEYWORDS.some(kw => text.includes(kw))) return false
  }
  return true
}

// ── Source Fetchers ───────────────────────────────────────────────────────────

async function fetchRSSFeed(feed: { url: string; source: string }): Promise<Article[]> {
  const res = await fetch(`${RSS_PROXY}${encodeURIComponent(feed.url)}`)
  if (!res.ok) throw new Error(`RSS ${feed.source}: HTTP ${res.status}`)
  const data = await res.json()
  if (data.status !== 'ok') throw new Error(`RSS ${feed.source}: ${data.message}`)
  return (data.items || []).map((item: any) => normalizeRSSItem(item, feed.source))
}

async function fetchNewsAPI(key: string): Promise<Article[]> {
  if (!key) return []
  const results = await Promise.allSettled(
    NEWSAPI_QUERIES.map(([q, preTag]) =>
      fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=50&apiKey=${key}`
      )
        .then(r => r.json())
        .then((data: any) => (data.articles || []).map((a: any) => normalizeNewsAPI(a, preTag)))
    )
  )
  const articles: Article[] = []
  results.forEach(r => { if (r.status === 'fulfilled') articles.push(...r.value) })
  return articles
}

async function fetchGNews(key: string): Promise<Article[]> {
  if (!key) return []
  const results = await Promise.allSettled(
    GNEWS_QUERIES.map(([q, preTag]) =>
      fetch(
        `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&max=10&apikey=${key}`
      )
        .then(r => r.json())
        .then((data: any) => (data.articles || []).map((a: any) => normalizeGNews(a, preTag)))
    )
  )
  const articles: Article[] = []
  results.forEach(r => { if (r.status === 'fulfilled') articles.push(...r.value) })
  return articles
}

async function fetchTheNewsAPI(key: string): Promise<Article[]> {
  if (!key) return []
  const results = await Promise.allSettled(
    THENEWSAPI_QUERIES.map(([q, preTag, categories]) =>
      fetch(
        `https://api.thenewsapi.com/v1/news/all?search=${encodeURIComponent(q)}&categories=${categories}&language=en&limit=25&api_token=${key}`
      )
        .then(r => r.json())
        .then((data: any) => (data.data || []).map((a: any) => normalizeTheNewsAPI(a, preTag)))
    )
  )
  const articles: Article[] = []
  results.forEach(r => { if (r.status === 'fulfilled') articles.push(...r.value) })
  return articles
}

async function fetchWorldNews(key: string): Promise<Article[]> {
  if (!key) return []
  const results = await Promise.allSettled(
    WORLDNEWS_QUERIES.map(([q, preTag]) =>
      fetch(
        `https://api.worldnewsapi.com/search-news?text=${encodeURIComponent(q)}&source-country=sa&language=en&number=20&api-key=${key}`
      )
        .then(r => r.json())
        .then((data: any) => (data.news || []).map((a: any) => normalizeWorldNews(a, preTag)))
    )
  )
  const articles: Article[] = []
  results.forEach(r => { if (r.status === 'fulfilled') articles.push(...r.value) })
  return articles
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const adminKey   = req.headers.get('x-admin-key')
  const ADMIN_PASS = Deno.env.get('ADMIN_PASSWORD') || 'Taitan12@@4'
  if (adminKey !== ADMIN_PASS) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const NEWSAPI_KEY    = Deno.env.get('NEWSAPI_KEY')    || '26c6395547cc40ab849d9a9bf8d14565'
  const GNEWS_KEY      = Deno.env.get('GNEWS_KEY')      || 'Bbfb0573262a3db87623edced855382b'
  const THENEWSAPI_KEY = Deno.env.get('THENEWSAPI_KEY') || 'joHu8ditzBiGk8BOeQ7sLzP5x0CloOMhoWXjM9Bw'
  const WORLDNEWS_KEY  = Deno.env.get('WORLDNEWS_KEY')  || 'e193f998af4e43e39d80c168d7234da4'

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const MAX_ARTICLES = 80

  console.log('[scheduled-fetch] Starting full news fetch from all sources...')

  let errorMsg = ''

  try {
    // Fire all source fetchers in parallel
    const sourceNames = ['NewsAPI', 'GNews', 'TheNewsAPI', 'WorldNews', ...RSS_FEEDS.map(f => f.source)]
    const results = await Promise.allSettled([
      fetchNewsAPI(NEWSAPI_KEY),
      fetchGNews(GNEWS_KEY),
      fetchTheNewsAPI(THENEWSAPI_KEY),
      fetchWorldNews(WORLDNEWS_KEY),
      ...RSS_FEEDS.map(feed => fetchRSSFeed(feed)),
    ])

    // Collect all articles and track per-source counts
    const allArticles: Article[] = []
    const sourceCounts: Record<string, number> = {}
    results.forEach((r, i) => {
      const name = sourceNames[i]
      if (r.status === 'fulfilled') {
        allArticles.push(...r.value)
        sourceCounts[name] = r.value.length
        console.log(`[scheduled-fetch] ${name}: ${r.value.length} articles`)
      } else {
        const msg = (r.reason as Error)?.message || String(r.reason)
        sourceCounts[name] = 0
        console.warn(`[scheduled-fetch] ${name} failed: ${msg}`)
      }
    })

    const raw = allArticles.length
    console.log(`[scheduled-fetch] Raw total: ${raw}`)

    // Apply 3-layer filter
    const filtered = allArticles.filter(passesFilter)
    console.log(`[scheduled-fetch] After filter: ${filtered.length}`)

    // Deduplicate by URL
    const seen = new Set<string>()
    const unique = filtered.filter(a => {
      if (!a.url || seen.has(a.url)) return false
      seen.add(a.url)
      return true
    })
    console.log(`[scheduled-fetch] After URL dedup: ${unique.length}`)

    // UPSERT in batches of 200 (Supabase row limit safety)
    const BATCH_SIZE = 200
    let stored = 0
    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const batch = unique.slice(i, i + BATCH_SIZE)
      const { error: upsertErr } = await supabase
        .from('articles')
        .upsert(batch, { onConflict: 'url', ignoreDuplicates: false })

      if (upsertErr) {
        console.error(`[scheduled-fetch] Upsert batch ${i / BATCH_SIZE + 1} error:`, upsertErr.message)
        errorMsg = upsertErr.message
      } else {
        stored += batch.length
        console.log(`[scheduled-fetch] Upserted batch ${i / BATCH_SIZE + 1}: ${batch.length} rows`)
      }
    }

    const ai_tagged = unique.filter(a => a.tag !== null).length

    // ── Trim to MAX_ARTICLES — delete oldest beyond the cap ───────────────────
    let trimmed = 0
    const { count: totalAfterUpsert } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })

    if (totalAfterUpsert && totalAfterUpsert > MAX_ARTICLES) {
      const excess = totalAfterUpsert - MAX_ARTICLES
      console.log(`[scheduled-fetch] DB has ${totalAfterUpsert} articles — trimming ${excess} oldest`)

      const { data: oldest } = await supabase
        .from('articles')
        .select('url')
        .not('published_at', 'is', null)
        .order('published_at', { ascending: true })
        .limit(excess)

      if (oldest && oldest.length > 0) {
        const urlsToDelete = oldest.map((a: any) => a.url)
        const { error: deleteErr } = await supabase
          .from('articles')
          .delete()
          .in('url', urlsToDelete)

        if (deleteErr) {
          console.error('[scheduled-fetch] Trim error:', deleteErr.message)
        } else {
          trimmed = urlsToDelete.length
          console.log(`[scheduled-fetch] Trimmed ${trimmed} oldest articles`)
        }
      }
    }

    console.log(`[scheduled-fetch] Done — stored: ${stored}, pre-tagged: ${ai_tagged}, trimmed: ${trimmed}`)

    // Record run in fetch_log
    await supabase.from('fetch_log').insert({
      ran_at:    new Date().toISOString(),
      stored,
      ai_tagged,
      status:    errorMsg ? 'error' : 'success',
      error_msg: errorMsg || null,
    })

    return new Response(
      JSON.stringify({ success: true, raw, stored, ai_tagged, trimmed, sources: sourceCounts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e: any) {
    console.error('[scheduled-fetch] Fatal error:', e.message)

    // Best-effort log write even on fatal error
    await supabase.from('fetch_log').insert({
      ran_at:    new Date().toISOString(),
      stored:    0,
      ai_tagged: 0,
      status:    'error',
      error_msg: e.message,
    }).catch(() => {})

    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
