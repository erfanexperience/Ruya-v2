// useNews.js
// Orchestrates news fetching, caching, AI processing, and filtering

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllNews } from '../services/newsService.js';
import { processArticlesBatch } from '../services/geminiService.js';
import {
  isCacheValid,
  isAICacheValid,
  getCachedArticles,
  setCachedArticles,
  markFetched,
  markAIRun,
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
        // Use cache
        articlesData = getCachedArticles();
        console.log('[Ruya] Using cached articles');
      } else {
        // Fresh fetch
        const raw = await fetchAllNews();
        articlesData = deduplicateArticles(raw);
        setCachedArticles(articlesData);
        markFetched();
        console.log(`[Ruya] Fresh fetch complete: ${articlesData.length} unique articles`);
      }

      // Run AI processing if needed
      if (!isAICacheValid() || forceRefresh) {
        // Only process articles that don't have summaries/tags yet
        const needsAI = articlesData.filter(a => !a.summary || !a.tag);
        if (needsAI.length > 0) {
          processArticlesBatch(needsAI).then(processed => {
            // Merge AI results back
            const merged = articlesData.map(a => {
              const p = processed.find(x => x.url === a.url);
              return p ? { ...a, summary: p.summary, tag: p.tag } : a;
            });
            setCachedArticles(merged);
            setArticles(merged);
            setArticleCount(merged.length);
            markAIRun();
          }).catch(e => {
            console.warn('[Ruya] AI processing failed:', e.message);
          });
        } else {
          markAIRun();
        }
      }

      setArticles(articlesData);
      setArticleCount(articlesData.length);
      setLastFetchTime(getLastFetchTime());
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

  // Ctrl+Shift+R force refresh
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        console.log('[Ruya] Manual cache clear triggered (Ctrl+Shift+R)');
        clearAllCache();
        loadArticles(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    : articles.filter(a => {
        const topicId = TAG_TO_TOPIC[a.tag] || 'all';
        return topicId === activeTopic || a.tag === activeTopic;
      });

  return {
    articles: filteredArticles,
    allArticles: articles,
    loading,
    error,
    activeTopic,
    setActiveTopic: handleTopicChange,
    articleCount,
    lastFetchTime,
    refresh: () => {
      clearAllCache();
      loadArticles(true);
    },
  };
}
