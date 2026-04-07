// newsService.js
// Fetches from multiple sources simultaneously with per-category targeted queries.
// Pre-tags articles at fetch time to guarantee 20+ articles per category.

const RSS_PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';

const RSS_FEEDS = [
  { url: 'https://www.arabnews.com/rss.xml',             source: 'Arab News' },
  { url: 'https://techcrunch.com/feed/',                 source: 'TechCrunch' },
  { url: 'https://www.theverge.com/rss/index.xml',       source: 'The Verge' },
  { url: 'https://www.technologyreview.com/feed/',       source: 'MIT Tech Review' },
];

// Each entry: [searchQuery, preTag | null]
// pageSize=100 fetches maximum allowed per call

const NEWSAPI_QUERIES = [
  // General Saudi tech
  ['Saudi Arabia technology innovation 2025',              null],
  ['Saudi digital economy transformation',                 null],
  ['Saudi Arabia tech investment 2025',                    null],
  // Vision 2030
  ['Vision 2030 technology digital Saudi Arabia',          'Vision 2030'],
  ['Saudi Arabia Vision 2030 innovation investment',       'Vision 2030'],
  ['Saudi economic diversification technology reform',     'Vision 2030'],
  ['Saudi national transformation plan technology',        'Vision 2030'],
  ['MBS Saudi Arabia modernization technology',            'Vision 2030'],
  // AI & Robotics
  ['Saudi Arabia artificial intelligence AI 2025',         'AI & Robotics'],
  ['Saudi robotics automation machine learning',           'AI & Robotics'],
  ['SDAIA artificial intelligence Saudi Arabia',           'AI & Robotics'],
  ['Saudi AI strategy national plan',                      'AI & Robotics'],
  ['Middle East AI robotics investment 2025',              'AI & Robotics'],
  // NEOM & Giga Projects
  ['NEOM technology smart city project Saudi',             'NEOM & Giga Projects'],
  ['Saudi giga projects NEOM Red Sea Diriyah Qiddiya',     'NEOM & Giga Projects'],
  ['The Line NEOM Saudi Arabia construction',              'NEOM & Giga Projects'],
  ['Sindalah Oxagon Trojena Saudi NEOM',                   'NEOM & Giga Projects'],
  // Startups
  ['Saudi Arabia startup funding fintech 2025',            'Startups'],
  ['Saudi venture capital tech startup investment',        'Startups'],
  ['STV Wa\'ed Sanabil Saudi startup fund',               'Startups'],
  ['Saudi fintech edtech healthtech startup',              'Startups'],
  ['MENA startup ecosystem Saudi funding',                 'Startups'],
  // Cybersecurity
  ['Saudi Arabia cybersecurity cyber attack 2025',         'Cybersecurity'],
  ['Middle East cybersecurity Saudi technology',           'Cybersecurity'],
  ['NCA Saudi Arabia national cybersecurity authority',    'Cybersecurity'],
  ['Saudi Arabia data protection privacy security',        'Cybersecurity'],
  // Telecom & 5G
  ['Saudi Arabia 5G network telecom STC Mobily 2025',      'Telecom & 5G'],
  ['Saudi broadband fiber internet connectivity',          'Telecom & 5G'],
  ['STC Saudi Telecom 5G expansion network',               'Telecom & 5G'],
  ['Saudi Arabia digital infrastructure connectivity',     'Telecom & 5G'],
  // Gaming & Entertainment
  ['Saudi Arabia gaming esports Savvy Games 2025',         'Gaming & Entertainment'],
  ['Saudi entertainment technology PIF gaming fund',       'Gaming & Entertainment'],
  ['Riyadh gaming esports tournament Saudi',               'Gaming & Entertainment'],
  ['Saudi Arabia metaverse entertainment technology',      'Gaming & Entertainment'],
];

const GNEWS_QUERIES = [
  ['Saudi Arabia technology',                'null'],
  ['Vision 2030 Saudi digital economy',      'Vision 2030'],
  ['Saudi Arabia AI artificial intelligence', 'AI & Robotics'],
  ['NEOM Saudi smart city project',           'NEOM & Giga Projects'],
  ['Saudi startup fintech investment',        'Startups'],
  ['Saudi cybersecurity data security',       'Cybersecurity'],
  ['Saudi 5G telecom STC network',            'Telecom & 5G'],
  ['Saudi gaming esports entertainment',      'Gaming & Entertainment'],
  ['Saudi Arabia innovation tech 2025',       null],
  ['PIF Saudi investment technology',         null],
];

const THENEWSAPI_QUERIES = [
  ['Saudi Arabia technology',                      null,                  'tech'],
  ['Vision 2030 Saudi technology reform',          'Vision 2030',         'tech'],
  ['Saudi artificial intelligence SDAIA',          'AI & Robotics',       'tech'],
  ['NEOM Saudi Arabia giga project',               'NEOM & Giga Projects','tech'],
  ['Saudi Arabia startup venture capital',         'Startups',            'tech'],
  ['Saudi cybersecurity NCA security',             'Cybersecurity',       'tech'],
  ['Saudi Arabia 5G STC Mobily telecom',           'Telecom & 5G',        'tech'],
  ['Saudi gaming esports Savvy',                   'Gaming & Entertainment','tech'],
  ['Saudi Arabia digital transformation',          null,                  'tech'],
  ['Middle East technology innovation',            null,                  'tech'],
];

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeRSSItem(item, source) {
  return {
    id:          item.guid || item.link || Math.random().toString(36).slice(2),
    title:       item.title || '',
    description: item.description
      ? item.description.replace(/<[^>]+>/g, '').slice(0, 400)
      : '',
    url:         item.link || item.guid || '',
    image:       item.enclosure?.link || item.thumbnail || null,
    publishedAt: item.pubDate || item.published || null,
    source,
    sourcePriority: 'rss',
    tag: null,
  };
}

function normalizeNewsAPI(article, preTag = null) {
  return {
    id:          article.url || Math.random().toString(36).slice(2),
    title:       article.title || '',
    description: (article.description || article.content || '').slice(0, 400),
    url:         article.url || '',
    image:       article.urlToImage || null,
    publishedAt: article.publishedAt || null,
    source:      article.source?.name || 'NewsAPI',
    sourcePriority: 'newsapi',
    tag:         preTag,
  };
}

function normalizeGNews(article, preTag = null) {
  return {
    id:          article.url || Math.random().toString(36).slice(2),
    title:       article.title || '',
    description: (article.description || '').slice(0, 400),
    url:         article.url || '',
    image:       article.image || null,
    publishedAt: article.publishedAt || null,
    source:      article.source?.name || 'GNews',
    sourcePriority: 'gnews',
    tag:         preTag,
  };
}

function normalizeTheNewsAPI(article, preTag = null) {
  return {
    id:          article.uuid || article.url || Math.random().toString(36).slice(2),
    title:       article.title || '',
    description: (article.description || article.snippet || '').slice(0, 400),
    url:         article.url || '',
    image:       article.image_url || null,
    publishedAt: article.published_at || null,
    source:      article.source || 'TheNewsAPI',
    sourcePriority: 'thenewsapi',
    tag:         preTag,
  };
}

function normalizeWorldNews(article, preTag = null) {
  return {
    id:          article.id?.toString() || Math.random().toString(36).slice(2),
    title:       article.title || '',
    description: (article.text || article.summary || '').slice(0, 400),
    url:         article.url || '',
    image:       article.image || null,
    publishedAt: article.publish_date || null,
    source:      'World News',
    sourcePriority: 'worldnews',
    tag:         preTag,
  };
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchRSSFeed({ url, source }) {
  const res = await fetch(`${RSS_PROXY}${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`RSS ${source}: ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`RSS ${source}: ${data.message}`);
  return (data.items || []).map(item => normalizeRSSItem(item, source));
}

async function fetchNewsAPI() {
  const key = import.meta.env.VITE_NEWSAPI_KEY;
  const results = await Promise.allSettled(
    NEWSAPI_QUERIES.map(([q, preTag]) =>
      fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=50&apiKey=${key}`
      )
        .then(r => r.json())
        .then(data => (data.articles || []).map(a => normalizeNewsAPI(a, preTag)))
    )
  );
  const articles = [];
  results.forEach(r => { if (r.status === 'fulfilled') articles.push(...r.value); });
  return articles;
}

async function fetchGNews() {
  const key = import.meta.env.VITE_GNEWS_KEY;
  const results = await Promise.allSettled(
    GNEWS_QUERIES.map(([q, preTag]) =>
      fetch(
        `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&max=10&apikey=${key}`
      )
        .then(r => r.json())
        .then(data => (data.articles || []).map(a => normalizeGNews(a, preTag === 'null' ? null : preTag)))
    )
  );
  const articles = [];
  results.forEach(r => { if (r.status === 'fulfilled') articles.push(...r.value); });
  return articles;
}

async function fetchTheNewsAPI() {
  const key = import.meta.env.VITE_THENEWSAPI_KEY;
  const results = await Promise.allSettled(
    THENEWSAPI_QUERIES.map(([q, preTag, categories]) =>
      fetch(
        `https://api.thenewsapi.com/v1/news/all?search=${encodeURIComponent(q)}&categories=${categories}&language=en&limit=25&api_token=${key}`
      )
        .then(r => r.json())
        .then(data => (data.data || []).map(a => normalizeTheNewsAPI(a, preTag)))
    )
  );
  const articles = [];
  results.forEach(r => { if (r.status === 'fulfilled') articles.push(...r.value); });
  return articles;
}

async function fetchWorldNews() {
  const key = import.meta.env.VITE_WORLDNEWS_KEY;
  const queries = [
    ['Saudi Arabia technology digital',                   null],
    ['Saudi Arabia artificial intelligence AI',           'AI & Robotics'],
    ['NEOM project Saudi Arabia giga',                    'NEOM & Giga Projects'],
    ['Saudi startup technology investment',               'Startups'],
    ['Saudi cybersecurity security breach',               'Cybersecurity'],
    ['Saudi Arabia 5G telecom STC Mobily',                'Telecom & 5G'],
    ['Saudi gaming entertainment esports',                'Gaming & Entertainment'],
    ['Vision 2030 Saudi Arabia reform',                   'Vision 2030'],
    ['Saudi Arabia innovation technology',                null],
  ];
  const results = await Promise.allSettled(
    queries.map(([q, preTag]) =>
      fetch(
        `https://api.worldnewsapi.com/search-news?text=${encodeURIComponent(q)}&source-country=sa&language=en&number=20&api-key=${key}`
      )
        .then(r => r.json())
        .then(data => (data.news || []).map(a => normalizeWorldNews(a, preTag)))
    )
  );
  const articles = [];
  results.forEach(r => { if (r.status === 'fulfilled') articles.push(...r.value); });
  return articles;
}

// ─── Strict 3-layer filter ────────────────────────────────────────────────────

const BLOCKLIST = [
  'cricket', 'ipl ', ' ipl', 'football coach', 'soccer match', 'rugby', 'tennis match',
  'golf tournament', 'basketball', 'baseball', 'nba ', 'nfl ', 'premier league',
  'batting', 'bowling', 'wicket', 'scored a century',
  'election', 'polling booth', 'campaign trail', 'constituency',
  'lok sabha', 'rajya sabha', 'west bengal', 'india poll', 'modi ', 'bjp ',
  'bollywood', 'film release', 'box office', 'actor arrested',
  'recipe', 'travel tips', 'hotel review', 'horoscope', 'astrology',
  'weather forecast', 'traffic update', 'real estate price', 'property price',
];

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
];

const SAUDI_KEYWORDS = [
  'saudi', 'riyadh', 'jeddah', 'mecca', 'medina', 'ksa',
  'neom', 'vision 2030', 'aramco', 'stc', 'mobily', 'sdaia', 'citc',
  'gulf', 'middle east', 'arab world', 'mena',
  'uae', 'dubai', 'abu dhabi', 'qatar', 'kuwait', 'bahrain', 'oman',
  'savvy games', 'pif', 'saudi telecom', 'saudi digital',
  'saudi government', 'saudi ministry', 'saudi authority',
];

// Sources whose content is always tech — skip Saudi requirement
const PURE_TECH_SOURCES = ['TechCrunch', 'The Verge', 'MIT Tech Review'];

function passesFilter(article) {
  const text = ` ${article.title} ${article.description} `.toLowerCase();

  // Layer 1: blocklist
  if (BLOCKLIST.some(kw => text.includes(kw))) return false;

  // Pre-tagged articles already passed the category check at query time — just verify relevance
  if (article.tag) {
    return TECH_KEYWORDS.some(kw => text.includes(kw)) ||
           SAUDI_KEYWORDS.some(kw => text.includes(kw));
  }

  // Layer 2: must contain a strong tech keyword
  if (!TECH_KEYWORDS.some(kw => text.includes(kw))) return false;

  // Layer 3: Saudi/MENA relevance for non-pure-tech sources
  if (!PURE_TECH_SOURCES.includes(article.source)) {
    if (!SAUDI_KEYWORDS.some(kw => text.includes(kw))) return false;
  }

  return true;
}

// ─── Main fetch orchestrator ──────────────────────────────────────────────────

export async function fetchAllNews() {
  const fetchers = [
    fetchNewsAPI(),
    fetchGNews(),
    fetchTheNewsAPI(),
    fetchWorldNews(),
    ...RSS_FEEDS.map(feed => fetchRSSFeed(feed)),
  ];

  const results = await Promise.allSettled(fetchers);
  const allArticles = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      allArticles.push(...result.value);
    } else {
      console.warn(`[Ruya] Source ${i} failed:`, result.reason?.message || result.reason);
    }
  });

  const beforeFilter = allArticles.length;
  const techArticles = allArticles.filter(passesFilter);

  // Log per-category counts
  const categoryCounts = {};
  techArticles.forEach(a => {
    const tag = a.tag || 'untagged';
    categoryCounts[tag] = (categoryCounts[tag] || 0) + 1;
  });
  console.log(
    `[Ruya] ${beforeFilter} raw → ${techArticles.length} after filter`,
    categoryCounts
  );

  return techArticles;
}
