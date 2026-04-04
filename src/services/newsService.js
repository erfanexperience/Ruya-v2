// newsService.js
// All API + RSS fetching logic — fetches from 9 sources simultaneously

const RSS_PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';

const RSS_FEEDS = [
  { url: 'https://www.spa.gov.sa/rss.xml', source: 'Saudi Press Agency' },
  { url: 'https://www.arabnews.com/rss.xml', source: 'Arab News' },
  { url: 'https://saudigazette.com.sa/feed', source: 'Saudi Gazette' },
  { url: 'https://english.alarabiya.net/rss.xml', source: 'Al Arabiya' },
];

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeRSSItem(item, source) {
  return {
    id: item.guid || item.link || Math.random().toString(36).slice(2),
    title: item.title || '',
    description: item.description
      ? item.description.replace(/<[^>]+>/g, '').slice(0, 300)
      : '',
    url: item.link || item.guid || '',
    image: item.enclosure?.link || item.thumbnail || null,
    publishedAt: item.pubDate || item.published || null,
    source,
    sourcePriority: 'rss',
  };
}

function normalizeNewsAPI(article) {
  return {
    id: article.url || Math.random().toString(36).slice(2),
    title: article.title || '',
    description: (article.description || article.content || '').slice(0, 300),
    url: article.url || '',
    image: article.urlToImage || null,
    publishedAt: article.publishedAt || null,
    source: article.source?.name || 'NewsAPI',
    sourcePriority: 'newsapi',
  };
}

function normalizeGNews(article) {
  return {
    id: article.url || Math.random().toString(36).slice(2),
    title: article.title || '',
    description: (article.description || '').slice(0, 300),
    url: article.url || '',
    image: article.image || null,
    publishedAt: article.publishedAt || null,
    source: article.source?.name || 'GNews',
    sourcePriority: 'gnews',
  };
}

function normalizeTheNewsAPI(article) {
  return {
    id: article.uuid || article.url || Math.random().toString(36).slice(2),
    title: article.title || '',
    description: (article.description || article.snippet || '').slice(0, 300),
    url: article.url || '',
    image: article.image_url || null,
    publishedAt: article.published_at || null,
    source: article.source || 'TheNewsAPI',
    sourcePriority: 'thenewsapi',
  };
}

function normalizeWorldNews(article) {
  return {
    id: article.id?.toString() || article.url || Math.random().toString(36).slice(2),
    title: article.title || '',
    description: (article.text || article.summary || '').slice(0, 300),
    url: article.url || '',
    image: article.image || null,
    publishedAt: article.publish_date || null,
    source: article.source_country ? `World News (${article.source_country})` : 'World News API',
    sourcePriority: 'worldnews',
  };
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchRSSFeed({ url, source }) {
  const res = await fetch(`${RSS_PROXY}${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`RSS fetch failed for ${source}: ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`RSS error for ${source}: ${data.message}`);
  return (data.items || []).map(item => normalizeRSSItem(item, source));
}

async function fetchNewsAPI() {
  const key = import.meta.env.VITE_NEWSAPI_KEY;
  const queries = [
    'Saudi Arabia technology',
    'Saudi Arabia AI',
    'Vision 2030 tech',
  ];
  const results = await Promise.allSettled(
    queries.map(q =>
      fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=15&apiKey=${key}`
      ).then(r => r.json())
    )
  );
  const articles = [];
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value.articles) {
      r.value.articles.forEach(a => articles.push(normalizeNewsAPI(a)));
    }
  });
  return articles;
}

async function fetchGNews() {
  const key = import.meta.env.VITE_GNEWS_KEY;
  const res = await fetch(
    `https://gnews.io/api/v4/search?q=Saudi+Arabia+tech&country=sa&lang=en&max=20&apikey=${key}`
  );
  if (!res.ok) throw new Error(`GNews failed: ${res.status}`);
  const data = await res.json();
  return (data.articles || []).map(normalizeGNews);
}

async function fetchTheNewsAPI() {
  const key = import.meta.env.VITE_THENEWSAPI_KEY;
  const results = await Promise.allSettled([
    fetch(
      `https://api.thenewsapi.com/v1/news/all?search=Saudi+Arabia+technology&categories=tech&language=en&limit=15&api_token=${key}`
    ).then(r => r.json()),
    fetch(
      `https://api.thenewsapi.com/v1/news/all?search=السعودية+التكنولوجيا&language=ar&limit=10&api_token=${key}`
    ).then(r => r.json()),
  ]);
  const articles = [];
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value.data) {
      r.value.data.forEach(a => articles.push(normalizeTheNewsAPI(a)));
    }
  });
  return articles;
}

async function fetchWorldNews() {
  const key = import.meta.env.VITE_WORLDNEWS_KEY;
  const res = await fetch(
    `https://api.worldnewsapi.com/search-news?source-country=sa&categories=technology&number=20&api-key=${key}`
  );
  if (!res.ok) throw new Error(`WorldNews failed: ${res.status}`);
  const data = await res.json();
  return (data.news || []).map(normalizeWorldNews);
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

  console.log(`[Ruya] Fetched ${allArticles.length} raw articles from ${results.filter(r => r.status === 'fulfilled').length} sources`);
  return allArticles;
}
