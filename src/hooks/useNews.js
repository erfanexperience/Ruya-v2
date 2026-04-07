// useNews.js
// Reads articles from Supabase (server-side fetched every 24h).
// Caches the read result in localStorage for 30 minutes per user.

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchArticlesFromDB } from '../services/supabaseService.js';

const CACHE_KEY      = 'ruya_sb_articles';
const CACHE_TIME_KEY = 'ruya_sb_fetch_time';
const CACHE_TTL      = 30 * 60 * 1000; // 30 minutes

// ─── Tag → topic ID mapping ───────────────────────────────────────────────────

const TAG_TO_TOPIC = {
  'Vision 2030':           'vision2030',
  'AI & Robotics':         'ai',
  'NEOM & Giga Projects':  'neom',
  'Startups':              'startups',
  'Cybersecurity':         'cyber',
  'Telecom & 5G':          'telecom',
  'Gaming & Entertainment':'gaming',
  'General':               'all',
};

// ─── Keyword fallback (fires when Gemini tag is absent) ──────────────────────

const TOPIC_KEYWORDS = {
  vision2030: ['vision 2030','vision2030','economic diversification','saudi 2030','national transformation','mbs reform','pif strategy'],
  ai:         ['artificial intelligence','machine learning','deep learning','neural network','chatgpt','openai','llm','generative ai','large language','robotics','autonomous','sdaia','ai model','ai strategy'],
  neom:       ['neom','giga project','giga-project','the line','red sea project','diriyah','qiddiya','sindalah','oxagon','trojena'],
  startups:   ['startup','start-up','venture capital','fintech','series a','series b','funding round','seed funding','edtech','healthtech','biotech','wa\'ed','sanabil'],
  cyber:      ['cybersecurity','cyber security','cyberattack','cyber attack','ransomware','malware','data breach','phishing','hacking','infosec','zero-day','nca saudi'],
  telecom:    ['5g network','5g technology','telecom','stc ','mobily','broadband','fiber optic','fiber internet','satellite internet','6g','telecommunications'],
  gaming:     ['gaming','esports','e-sports','savvy games','video game','game developer','game studio','pif gaming','saudi gaming','qiddiya gaming'],
};

function articleMatchesTopic(article, topic) {
  // 1. Gemini tag takes priority
  if (article.tag) {
    const topicId = TAG_TO_TOPIC[article.tag];
    if (topicId === topic) return true;
    if (article.tag === topic) return true;
  }
  // 2. Keyword fallback on title + description + summary
  const keywords = TOPIC_KEYWORDS[topic];
  if (!keywords) return false;
  const text = ` ${article.title} ${article.description} ${article.summary || ''} `.toLowerCase();
  return keywords.some(kw => text.includes(kw));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNews() {
  const [articles, setArticles]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [activeTopic, setActiveTopic] = useState('all');
  const [articleCount, setArticleCount] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const debounceRef = useRef(null);

  const loadArticles = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      // Check local 30-min cache first (avoids hammering Supabase on every visit)
      if (!forceRefresh) {
        try {
          const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
          const cachedRaw  = localStorage.getItem(CACHE_KEY);
          if (cachedTime && cachedRaw && Date.now() - parseInt(cachedTime) < CACHE_TTL) {
            const cached = JSON.parse(cachedRaw);
            if (cached.length > 0) {
              setArticles(cached);
              setArticleCount(cached.length);
              setLastFetchTime(parseInt(cachedTime));
              setLoading(false);
              return;
            }
          }
        } catch { /* ignore parse errors, fetch fresh */ }
      }

      // Fetch from Supabase
      const data = await fetchArticlesFromDB();
      const now = Date.now();

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(CACHE_TIME_KEY, now.toString());
      } catch { /* quota full — fine, just don't cache */ }

      setArticles(data);
      setArticleCount(data.length);
      setLastFetchTime(now);
    } catch (e) {
      console.error('[Ruya] Failed to load from Supabase:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArticles(false);
  }, [loadArticles]);

  const handleTopicChange = useCallback((topic) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setActiveTopic(topic), 300);
  }, []);

  const filteredArticles = activeTopic === 'all'
    ? articles
    : articles.filter(a => articleMatchesTopic(a, activeTopic));

  const refresh = useCallback(() => {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIME_KEY);
    } catch { /* ignore */ }
    loadArticles(true);
  }, [loadArticles]);

  return {
    articles: filteredArticles,
    allArticles: articles,
    loading,
    error,
    activeTopic,
    setActiveTopic: handleTopicChange,
    articleCount,
    lastFetchTime,
    refresh,
  };
}
