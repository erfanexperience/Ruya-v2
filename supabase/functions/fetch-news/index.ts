// supabase/functions/fetch-news/index.ts
// Deno edge function — fetches all news sources, deduplicates, upserts to DB.
// Called by: daily pg_cron OR admin panel (x-admin-key header).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article {
  url: string
  title: string
  description: string
  image: string | null
  publishedAt: string | null
  source: string
  sourcePriority: string
  tag: string | null
}

// ─── Feeds & Queries ──────────────────────────────────────────────────────────

const RSS_PROXY = 'https://api.rss2json.com/v1/api.json?rss_url='
const RSS_FEEDS = [
  { url: 'https://www.arabnews.com/rss.xml',            source: 'Arab News' },
  { url: 'https://techcrunch.com/feed/',                source: 'TechCrunch' },
  { url: 'https://www.theverge.com/rss/index.xml',      source: 'The Verge' },
  { url: 'https://www.technologyreview.com/feed/',      source: 'MIT Tech Review' },
]

const NEWSAPI_QUERIES: [string, string | null][] = [
  ['Saudi Arabia technology innovation 2025',             null],
  ['Saudi digital economy transformation',               null],
  ['Vision 2030 technology digital Saudi Arabia',        'Vision 2030'],
  ['Saudi Arabia Vision 2030 innovation investment',     'Vision 2030'],
  ['Saudi economic diversification technology reform',   'Vision 2030'],
  ['Saudi Arabia artificial intelligence AI 2025',       'AI & Robotics'],
  ['Saudi robotics automation machine learning',         'AI & Robotics'],
  ['SDAIA artificial intelligence Saudi Arabia',         'AI & Robotics'],
  ['NEOM technology smart city project Saudi',           'NEOM & Giga Projects'],
  ['Saudi giga projects NEOM Red Sea Diriyah Qiddiya',   'NEOM & Giga Projects'],
  ['The Line NEOM Saudi Arabia construction',            'NEOM & Giga Projects'],
  ['Saudi Arabia startup funding fintech 2025',          'Startups'],
  ['Saudi venture capital tech startup investment',      'Startups'],
  ['MENA startup ecosystem Saudi funding 2025',          'Startups'],
  ['Saudi Arabia cybersecurity cyber attack 2025',       'Cybersecurity'],
  ['NCA Saudi Arabia national cybersecurity authority',  'Cybersecurity'],
  ['Middle East cybersecurity Saudi technology',         'Cybersecurity'],
  ['Saudi Arabia 5G network telecom STC Mobily 2025',   'Telecom & 5G'],
  ['Saudi broadband fiber internet connectivity',        'Telecom & 5G'],
  ['STC Saudi Telecom 5G expansion network',             'Telecom & 5G'],
  ['Saudi Arabia gaming esports Savvy Games 2025',       'Gaming & Entertainment'],
  ['Saudi entertainment technology PIF gaming fund',     'Gaming & Entertainment'],
  ['Riyadh gaming esports tournament Saudi',             'Gaming & Entertainment'],
]

const GNEWS_QUERIES: [string, string | null][] = [
  ['Saudi Arabia technology',                            null],
  ['Vision 2030 Saudi digital economy',                 'Vision 2030'],
  ['Saudi Arabia AI artificial intelligence',           'AI & Robotics'],
  ['NEOM Saudi smart city project',                     'NEOM & Giga Projects'],
  ['Saudi startup fintech investment',                   'Startups'],
  ['Saudi cybersecurity data security',                  'Cybersecurity'],
  ['Saudi 5G telecom STC network',                       'Telecom & 5G'],
  ['Saudi gaming esports entertainment',                 'Gaming & Entertainment'],
]

const THENEWSAPI_QUERIES: [string, string | null, string][] = [
  ['Saudi Arabia technology',                            null,                  'tech'],
  ['Vision 2030 Saudi technology reform',               'Vision 2030',         'tech'],
  ['Saudi artificial intelligence SDAIA',               'AI & Robotics',       'tech'],
  ['NEOM Saudi Arabia giga project',                    'NEOM & Giga Projects','tech'],
  ['Saudi Arabia startup venture capital',              'Startups',            'tech'],
  ['Saudi cybersecurity NCA security',                  'Cybersecurity',       'tech'],
  ['Saudi Arabia 5G STC Mobily telecom',                'Telecom & 5G',        'tech'],
  ['Saudi gaming esports Savvy',                        'Gaming & Entertainment','tech'],
]

const WORLDNEWS_QUERIES: [string, string | null][] = [
  ['Saudi Arabia technology digital',                    null],
  ['Saudi Arabia artificial intelligence AI',           'AI & Robotics'],
  ['NEOM project Saudi Arabia giga',                    'NEOM & Giga Projects'],
  ['Saudi startup technology investment',               'Startups'],
  ['Saudi cybersecurity security breach',               'Cybersecurity'],
  ['Saudi Arabia 5G telecom STC Mobily',                'Telecom & 5G'],
  ['Saudi gaming entertainment esports',                'Gaming & Entertainment'],
  ['Vision 2030 Saudi Arabia reform',                   'Vision 2030'],
]

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeRSS(item: any, source: string): Article {
  return {
    url:          item.link || item.guid || '',
    title:        item.title || '',
    description:  (item.description || '').replace(/<[^>]+>/g, '').slice(0, 400),
    image:        item.enclosure?.link || item.thumbnail || null,
    publishedAt:  item.pubDate || item.published || null,
    source,
    sourcePriority: 'rss',
    tag:          null,
  }
}

function normalizeNewsAPI(a: any, tag: string | null): Article {
  return {
    url:          a.url || '',
    title:        a.title || '',
    description:  (a.description || a.content || '').slice(0, 400),
    image:        a.urlToImage || null,
    publishedAt:  a.publishedAt || null,
    source:       a.source?.name || 'NewsAPI',
    sourcePriority: 'newsapi',
    tag,
  }
}

function normalizeGNews(a: any, tag: string | null): Article {
  return {
    url:          a.url || '',
    title:        a.title || '',
    description:  (a.description || '').slice(0, 400),
    image:        a.image || null,
    publishedAt:  a.publishedAt || null,
    source:       a.source?.name || 'GNews',
    sourcePriority: 'gnews',
    tag,
  }
}

function normalizeTheNewsAPI(a: any, tag: string | null): Article {
  return {
    url:          a.url || '',
    title:        a.title || '',
    description:  (a.description || a.snippet || '').slice(0, 400),
    image:        a.image_url || null,
    publishedAt:  a.published_at || null,
    source:       a.source || 'TheNewsAPI',
    sourcePriority: 'thenewsapi',
    tag,
  }
}

function normalizeWorldNews(a: any, tag: string | null): Article {
  return {
    url:          a.url || '',
    title:        a.title || '',
    description:  (a.text || a.summary || '').slice(0, 400),
    image:        a.image || null,
    publishedAt:  a.publish_date || null,
    source:       'World News',
    sourcePriority: 'worldnews',
    tag,
  }
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchRSS(feed: { url: string; source: string }): Promise<Article[]> {
  const res = await fetch(`${RSS_PROXY}${encodeURIComponent(feed.url)}`)
  if (!res.ok) throw new Error(`RSS ${feed.source}: ${res.status}`)
  const data = await res.json()
  if (data.status !== 'ok') throw new Error(`RSS ${feed.source}: ${data.message}`)
  return (data.items || []).map((item: any) => normalizeRSS(item, feed.source))
}

async function fetchNewsAPI(key: string): Promise<Article[]> {
  const results = await Promise.allSettled(
    NEWSAPI_QUERIES.map(([q, tag]) =>
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=50&apiKey=${key}`)
        .then(r => r.json())
        .then(data => (data.articles || []).map((a: any) => normalizeNewsAPI(a, tag)))
    )
  )
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
}

async function fetchGNews(key: string): Promise<Article[]> {
  const results = await Promise.allSettled(
    GNEWS_QUERIES.map(([q, tag]) =>
      fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&max=10&apikey=${key}`)
        .then(r => r.json())
        .then(data => (data.articles || []).map((a: any) => normalizeGNews(a, tag)))
    )
  )
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
}

async function fetchTheNewsAPI(key: string): Promise<Article[]> {
  const results = await Promise.allSettled(
    THENEWSAPI_QUERIES.map(([q, tag, categories]) =>
      fetch(`https://api.thenewsapi.com/v1/news/all?search=${encodeURIComponent(q)}&categories=${categories}&language=en&limit=25&api_token=${key}`)
        .then(r => r.json())
        .then(data => (data.data || []).map((a: any) => normalizeTheNewsAPI(a, tag)))
    )
  )
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
}

async function fetchWorldNews(key: string): Promise<Article[]> {
  const results = await Promise.allSettled(
    WORLDNEWS_QUERIES.map(([q, tag]) =>
      fetch(`https://api.worldnewsapi.com/search-news?text=${encodeURIComponent(q)}&source-country=sa&language=en&number=20&api-key=${key}`)
        .then(r => r.json())
        .then(data => (data.news || []).map((a: any) => normalizeWorldNews(a, tag)))
    )
  )
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
}

// ─── Filter ───────────────────────────────────────────────────────────────────

const BLOCKLIST = [
  'cricket', 'ipl ', ' ipl', 'soccer match', 'rugby match', 'tennis match',
  'golf tournament', 'nba ', 'nfl ', 'premier league',
  'batting', 'bowling', 'wicket',
  'lok sabha', 'rajya sabha', 'india poll', 'bjp ',
  'bollywood', 'box office collection',
  'horoscope', 'astrology',
]

const TECH_KEYWORDS = [
  // AI
  'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
  'chatgpt', 'openai', 'gemini', 'llm', 'generative ai', 'ai model',
  // Robotics / autonomous
  'robotics', 'autonomous vehicle', 'self-driving', 'drone',
  // Security
  'cybersecurity', 'cyber security', 'cyberattack', 'ransomware', 'data breach', 'hacking',
  // Hardware
  'semiconductor', 'microchip', 'gpu', 'processor chip',
  // Connectivity
  '5g', '6g', 'broadband', 'fiber optic', 'telecom', 'satellite internet',
  // Tech business
  'blockchain', 'quantum computing', 'cloud computing', 'data center',
  'startup', 'venture capital', 'fintech', 'edtech', 'healthtech',
  'tech company', 'technology company', 'software', 'digital platform', 'mobile app',
  // Saudi-specific tech
  'neom', 'vision 2030', 'sdaia', 'smart city', 'giga project', 'digital transformation',
  'savvy games', 'qiddiya', 'sindalah', 'the line',
  // Entertainment tech
  'esports', 'gaming', 'metaverse', 'virtual reality', 'augmented reality',
  // Innovation
  'innovation', 'technology', 'digital economy', 'tech hub',
]

const SAUDI_KEYWORDS = [
  'saudi', 'riyadh', 'jeddah', 'ksa', 'neom', 'vision 2030', 'aramco',
  'stc', 'mobily', 'sdaia', 'gulf', 'middle east', 'mena', 'arab',
  'uae', 'dubai', 'abu dhabi', 'qatar', 'kuwait', 'bahrain', 'oman',
  'savvy games', 'pif', 'saudi fund',
]

const PURE_TECH_SOURCES = ['TechCrunch', 'The Verge', 'MIT Tech Review']

function passesFilter(a: Article): boolean {
  if (!a.title || a.title.length < 10) return false
  // Skip [Removed] articles (NewsAPI free tier)
  if (a.title.includes('[Removed]') || a.description?.includes('[Removed]')) return false
  const text = ` ${a.title} ${a.description} `.toLowerCase()
  if (BLOCKLIST.some(kw => text.includes(kw))) return false
  // Pre-tagged articles: just need one relevance signal
  if (a.tag) return TECH_KEYWORDS.some(kw => text.includes(kw)) || SAUDI_KEYWORDS.some(kw => text.includes(kw))
  // Pure tech sources: only need tech keyword
  if (PURE_TECH_SOURCES.includes(a.source)) return TECH_KEYWORDS.some(kw => text.includes(kw))
  // Others: need BOTH tech AND Saudi
  return TECH_KEYWORDS.some(kw => text.includes(kw)) && SAUDI_KEYWORDS.some(kw => text.includes(kw))
}

// ─── Deduplication ────────────────────────────────────────────────────────────

const SOURCE_PRIORITY = ['Arab News', 'TechCrunch', 'MIT Tech Review', 'The Verge', 'NewsAPI', 'GNews', 'TheNewsAPI', 'World News']

function getSourcePriority(source: string): number {
  const idx = SOURCE_PRIORITY.findIndex(s => (source || '').toLowerCase().includes(s.toLowerCase()))
  return idx === -1 ? SOURCE_PRIORITY.length : idx
}

function normalizeTitle(title: string): string {
  const stop = new Set(['the','a','an','in','of','for','to','and','or','is','are','was','on','at','by','with','from','its','this','that'])
  return (title || '').toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w))
    .sort().join(' ')
}

function wordOverlap(a: string, b: string): number {
  const wa = new Set(a.split(/\s+/).filter(w => w.length > 2))
  const wb = new Set(b.split(/\s+/).filter(w => w.length > 2))
  if (!wa.size || !wb.size) return 0
  let overlap = 0
  wa.forEach(w => { if (wb.has(w)) overlap++ })
  return overlap / Math.min(wa.size, wb.size)
}

function deduplicateArticles(articles: Article[]): Article[] {
  const seenUrls = new Map<string, number>()
  const seenFps  = new Map<string, number>()
  const result: Article[] = []

  for (const article of articles) {
    if (!article.url || !article.title) continue
    const url = article.url.trim()
    const fp  = normalizeTitle(article.title)

    if (url && seenUrls.has(url)) {
      const idx = seenUrls.get(url)!
      if (getSourcePriority(article.source) < getSourcePriority(result[idx].source)) result[idx] = article
      continue
    }
    if (fp && seenFps.has(fp)) {
      const idx = seenFps.get(fp)!
      if (getSourcePriority(article.source) < getSourcePriority(result[idx].source)) result[idx] = article
      continue
    }
    const slice = result.slice(-80)
    let isDup = false
    for (let i = 0; i < slice.length; i++) {
      if (wordOverlap(fp, normalizeTitle(slice[i].title)) > 0.7) {
        const gi = result.length - slice.length + i
        if (getSourcePriority(article.source) < getSourcePriority(result[gi].source)) result[gi] = article
        isDup = true; break
      }
    }
    if (!isDup) {
      const idx = result.length
      result.push(article)
      if (url) seenUrls.set(url, idx)
      if (fp)  seenFps.set(fp, idx)
    }
  }
  return result
}

// ─── Gemini helpers ───────────────────────────────────────────────────────────

const VALID_TAGS = ['Vision 2030','AI & Robotics','NEOM & Giga Projects','Startups','Cybersecurity','Telecom & 5G','Gaming & Entertainment','General']
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

async function callGemini(prompt: string, key: string, maxTokens = 64): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens } }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
}

async function geminiTag(title: string, key: string): Promise<string> {
  const raw = await callGemini(
    `Classify this news article into exactly ONE category from this list:\nVision 2030, AI & Robotics, NEOM & Giga Projects, Startups, Cybersecurity, Telecom & 5G, Gaming & Entertainment, General\nTitle: ${title}\nReply with only the category name. Nothing else.`,
    key, 32
  )
  return VALID_TAGS.find(t => raw.includes(t)) || 'General'
}


// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Auth: must include admin password
  const adminKey    = req.headers.get('x-admin-key')
  const ADMIN_PASS  = Deno.env.get('ADMIN_PASSWORD') || 'Taitan12@@4'
  if (adminKey !== ADMIN_PASS) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const NEWSAPI_KEY     = Deno.env.get('NEWSAPI_KEY')     || ''
  const GNEWS_KEY       = Deno.env.get('GNEWS_KEY')       || ''
  const THENEWSAPI_KEY  = Deno.env.get('THENEWSAPI_KEY')  || ''
  const WORLDNEWS_KEY   = Deno.env.get('WORLDNEWS_KEY')   || ''
  const GEMINI_KEY      = Deno.env.get('GEMINI_KEY')      || ''

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const logEntry = { ran_at: new Date().toISOString(), raw_count: 0, stored: 0, ai_tagged: 0, status: 'ok', error_msg: null as string | null }

  try {
    // ── 1. Fetch all sources in parallel ──────────────────────────────────────
    console.log('[fetch-news] Fetching all sources...')
    const fetchers = await Promise.allSettled([
      NEWSAPI_KEY    ? fetchNewsAPI(NEWSAPI_KEY)         : Promise.resolve([]),
      GNEWS_KEY      ? fetchGNews(GNEWS_KEY)             : Promise.resolve([]),
      THENEWSAPI_KEY ? fetchTheNewsAPI(THENEWSAPI_KEY)   : Promise.resolve([]),
      WORLDNEWS_KEY  ? fetchWorldNews(WORLDNEWS_KEY)     : Promise.resolve([]),
      ...RSS_FEEDS.map(f => fetchRSS(f)),
    ])

    const allRaw: Article[] = []
    fetchers.forEach((r, i) => {
      if (r.status === 'fulfilled') allRaw.push(...r.value)
      else console.warn(`[fetch-news] Source ${i} failed:`, (r as PromiseRejectedResult).reason?.message)
    })

    // ── 2. Filter + deduplicate ───────────────────────────────────────────────
    const filtered = allRaw.filter(passesFilter)
    const deduped  = deduplicateArticles(filtered)
    logEntry.raw_count = allRaw.length
    console.log(`[fetch-news] ${allRaw.length} raw → ${filtered.length} filtered → ${deduped.length} unique`)

    // ── 3. Cleanup: keep DB within free tier cap (5,000 articles max) ────────
    const ARTICLE_CAP = 5000
    const { count: currentCount } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })

    if (currentCount && currentCount > ARTICLE_CAP) {
      // Find the cutoff date for the oldest articles beyond the cap
      const { data: cutoffRow } = await supabase
        .from('articles')
        .select('fetched_at')
        .order('fetched_at', { ascending: true })
        .range(ARTICLE_CAP - 1, ARTICLE_CAP)
        .limit(1)

      if (cutoffRow?.[0]?.fetched_at) {
        const { count: deleted } = await supabase
          .from('articles')
          .delete({ count: 'exact' })
          .lt('fetched_at', cutoffRow[0].fetched_at)
        console.log(`[fetch-news] Cleanup: removed ${deleted} old articles to stay under ${ARTICLE_CAP} cap`)
      }
    }

    // Also remove articles older than 30 days regardless of count
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('articles').delete().lt('published_at', cutoff)

    // ── 4. Upsert in batches of 50 ────────────────────────────────────────────
    const rows = deduped.map(a => ({
      url:             a.url,
      title:           a.title,
      description:     a.description || '',
      image:           a.image,
      published_at:    a.publishedAt,
      source:          a.source,
      source_priority: a.sourcePriority,
      tag:             a.tag,
      summary:         a.description || '',
      fetched_at:      new Date().toISOString(),
    }))

    let upserted = 0
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await supabase
        .from('articles')
        .upsert(rows.slice(i, i + 50), { onConflict: 'url', ignoreDuplicates: false })
      if (error) console.warn('[fetch-news] Upsert batch error:', error.message)
      else upserted += Math.min(50, rows.length - i)
    }
    logEntry.stored = upserted

    // ── 5. Gemini tagging for articles with no tag (up to 40 per run) ──────────
    if (GEMINI_KEY) {
      const { data: untagged } = await supabase
        .from('articles')
        .select('url, title')
        .is('tag', null)
        .limit(40)

      if (untagged && untagged.length > 0) {
        console.log(`[fetch-news] Gemini tagging ${untagged.length} articles...`)
        for (const article of untagged) {
          try {
            const tag = await geminiTag(article.title, GEMINI_KEY)
            await supabase.from('articles').update({ tag }).eq('url', article.url)
            logEntry.ai_tagged++
          } catch (e: any) {
            console.warn('[fetch-news] Gemini tag failed:', e.message)
          }
          await new Promise(r => setTimeout(r, 1200)) // 15 RPM rate limit
        }
      }
    }

    // ── 6. Log the run ────────────────────────────────────────────────────────
    await supabase.from('fetch_log').insert(logEntry)

    return new Response(JSON.stringify({
      success:    true,
      raw:        allRaw.length,
      filtered:   filtered.length,
      stored:     upserted,
      ai_tagged:  logEntry.ai_tagged,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e: any) {
    console.error('[fetch-news] Fatal error:', e)
    logEntry.status = 'error'
    logEntry.error_msg = e.message
    await supabase.from('fetch_log').insert(logEntry).catch(() => {})
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
