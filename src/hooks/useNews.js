// useNews.js
// Orchestrates news fetching, caching, AI processing, and filtering

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllNews } from '../services/newsService.js';
import { processArticlesBatch, batchTranslateToArabic } from '../services/geminiService.js';
import {
  isCacheValid,
  isAICacheValid,
  isTranslationCacheValid,
  getCachedArticles,
  setCachedArticles,
  markFetched,
  markAIRun,
  markTranslationRun,
  clearAllCache,
  getLastFetchTime,
  deduplicateArticles,
} from '../services/cacheService.js';

// Tag → topic ID mapping
const TAG_TO_TOPIC = {
  'Vision 2030': 'vision2030',
  'AI & Robotics': 'ai',
  'NEOM & Giga Projects': 'neom',
  'Startups': 'startups',
  'Cybersecurity': 'cyber',
  'Telecom & 5G': 'telecom',
  'Gaming & Entertainment': 'gaming',
  'General': 'all',
};

// Keyword fallback for articles not yet tagged by Gemini
const TOPIC_KEYWORDS = {
  vision2030: ['vision 2030', 'vision2030', 'economic diversification', 'saudi economic reform', 'neom vision', 'saudi 2030', 'national transformation', 'mbs reform'],
  ai: ['artificial intelligence', 'machine learning', 'deep learning', 'neural network', 'chatgpt', 'openai', 'llm', 'generative ai', 'large language', 'robotics', 'autonomous', 'sdaia', 'ai model', 'ai startup', 'ai strategy'],
  neom: ['neom', 'giga project', 'giga-project', 'the line', 'red sea project', 'diriyah', 'qiddiya', 'sindalah', 'oxagon', 'trojena'],
  startups: ['startup', 'start-up', 'venture capital', 'fintech', 'series a', 'series b', 'funding round', 'seed funding', 'edtech', 'healthtech', 'biotech', 'proptech', 'insurtech', 'stv fund', 'wa\'ed', 'sanabil'],
  cyber: ['cybersecurity', 'cyber security', 'cyberattack', 'cyber attack', 'ransomware', 'malware', 'data breach', 'phishing', 'hacking', 'infosec', 'zero-day', 'vulnerability', 'nca saudi'],
  telecom: ['5g network', '5g technology', 'telecom', 'stc ', 'mobily', 'broadband', 'fiber optic', 'fiber internet', 'satellite internet', '6g', 'telecommunications'],
  gaming: ['gaming', 'esports', 'e-sports', 'savvy games', 'video game', 'game developer', 'game studio', 'pif gaming', 'saudi gaming', 'entertainment technology', 'qiddiya gaming'],
};

function articleMatchesTopic(article, topic) {
  // First try Gemini tag
  if (article.tag) {
    const topicId = TAG_TO_TOPIC[article.tag];
    if (topicId === topic) return true;
    if (article.tag === topic) return true;
  }
  // Fallback: keyword matching on title + description + summary
  const keywords = TOPIC_KEYWORDS[topic];
  if (!keywords) return false;
  const text = ` ${article.title} ${article.description} ${article.summary || ''} `.toLowerCase();
  return keywords.some(kw => text.includes(kw));
}

export function useNews() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTopic, setActiveTopic] = useState('all');
  const [articleCount, setArticleCount] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const debounceRef = useRef(null);

  const loadArticles = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      let articlesData;

      if (!forceRefresh && isCacheValid()) {
        articlesData = getCachedArticles();
        console.log('[Ruya] Using cached articles');
      } else {
        const raw = await fetchAllNews();
        articlesData = deduplicateArticles(raw);
        setCachedArticles(articlesData);
        markFetched();
        console.log(`[Ruya] Fresh fetch complete: ${articlesData.length} unique articles`);
      }

      setArticles(articlesData);
      setArticleCount(articlesData.length);
      setLastFetchTime(getLastFetchTime());

      // Run AI processing (summaries + tags) if needed
      if (!isAICacheValid() || forceRefresh) {
        const needsAI = articlesData.filter(a => !a.summary || !a.tag);
        if (needsAI.length > 0) {
          processArticlesBatch(needsAI).then(processed => {
            const merged = articlesData.map(a => {
              const p = processed.find(x => x.url === a.url);
              return p ? { ...a, summary: p.summary, tag: p.tag } : a;
            });
            setCachedArticles(merged);
            setArticles(merged);
            setArticleCount(merged.length);
            markAIRun();

            // After AI processing, kick off Arabic pre-translation in background
            if (!isTranslationCacheValid() || forceRefresh) {
              batchTranslateToArabic(merged).then(() => {
                markTranslationRun();
              }).catch(e => {
                console.warn('[Ruya] Arabic batch translation failed:', e.message);
              });
            }
          }).catch(e => {
            console.warn('[Ruya] AI processing failed:', e.message);
          });
        } else {
          markAIRun();
          // Trigger Arabic pre-translation if not cached
          if (!isTranslationCacheValid() || forceRefresh) {
            batchTranslateToArabic(articlesData).then(() => {
              markTranslationRun();
            }).catch(e => {
              console.warn('[Ruya] Arabic batch translation failed:', e.message);
            });
          }
        }
      }
    } catch (e) {
      console.error('[Ruya] Load failed:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArticles(false);
  }, [loadArticles]);

  // Debounced topic switch (300ms)
  const handleTopicChange = useCallback((topic) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActiveTopic(topic);
    }, 300);
  }, []);

  const filteredArticles = activeTopic === 'all'
    ? articles
    : articles.filter(a => articleMatchesTopic(a, activeTopic));

  const refresh = useCallback(() => {
    clearAllCache();
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
