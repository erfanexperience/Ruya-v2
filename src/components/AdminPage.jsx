// AdminPage.jsx
// Admin control panel — password protected, accessible at /admin

import { useState, useEffect } from 'react';
import {
  getCachedArticles,
  setCachedArticles,
  clearAllCache,
  getLastFetchTime,
  isCacheValid,
  isAICacheValid,
  isTranslationCacheValid,
  markFetched,
  markAIRun,
  markTranslationRun,
  deduplicateArticles,
} from '../services/cacheService.js';
import { fetchAllNews } from '../services/newsService.js';
import { processArticlesBatch, batchTranslateToArabic } from '../services/geminiService.js';

const ADMIN_PASSWORD = 'Global$23';

const TAG_LABELS = {
  'Vision 2030':        'Vision 2030',
  'AI & Robotics':      'AI & Robotics',
  'NEOM & Giga Projects': 'Giga Projects',
  'Startups':           'Startups',
  'Cybersecurity':      'Cybersecurity',
  'Telecom & 5G':       'Telecom & 5G',
  'Gaming & Entertainment': 'Gaming',
  'General':            'General',
  null:                 'Untagged',
};

function timeAgo(ts) {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m ago`;
  return `${m}m ago`;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState(false);

  const [articles, setArticles] = useState([]);
  const [lastFetch, setLastFetch] = useState(null);
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');

  function handleLogin(e) {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true);
      loadStats();
    } else {
      setPwError(true);
      setTimeout(() => setPwError(false), 2000);
    }
  }

  function loadStats() {
    const cached = getCachedArticles() || [];
    setArticles(cached);
    setLastFetch(getLastFetchTime());
  }

  useEffect(() => {
    if (authed) loadStats();
  }, [authed]);

  async function handleForceRefresh() {
    setRunning(true);
    setStatus('');

    try {
      setProgress('Clearing cache...');
      clearAllCache();

      setProgress('Fetching fresh articles from all sources...');
      const raw = await fetchAllNews();
      const deduped = deduplicateArticles(raw);
      setCachedArticles(deduped);
      markFetched();

      setProgress(`Fetched ${deduped.length} articles. Running Gemini AI (summaries + tags)...`);
      const needsAI = deduped.filter(a => !a.summary || !a.tag);
      let finalArticles = deduped;
      if (needsAI.length > 0) {
        const processed = await processArticlesBatch(needsAI);
        finalArticles = deduped.map(a => {
          const p = processed.find(x => x.url === a.url);
          return p ? { ...a, summary: p.summary, tag: p.tag } : a;
        });
        setCachedArticles(finalArticles);
        markAIRun();
      }

      setProgress(`AI processing done. Pre-translating ${finalArticles.length} articles to Arabic...`);
      await batchTranslateToArabic(finalArticles);
      markTranslationRun();

      setArticles(finalArticles);
      setLastFetch(getLastFetchTime());
      setStatus('success');
      setProgress('');
    } catch (e) {
      console.error('[Admin] Force refresh failed:', e);
      setStatus('error');
      setProgress('Error: ' + e.message);
    } finally {
      setRunning(false);
    }
  }

  // Category counts
  const categoryCounts = {};
  Object.keys(TAG_LABELS).forEach(k => { categoryCounts[k] = 0; });
  articles.forEach(a => {
    const key = a.tag || null;
    if (categoryCounts[key] !== undefined) categoryCounts[key]++;
    else categoryCounts[key] = 1;
  });

  // ── Login screen ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="admin-shell">
        <div className="admin-login">
          <div className="admin-logo">
            <img src="/Assets/Logo.webp" alt="Ru'ya" style={{ maxHeight: 40, marginBottom: 12 }} />
            <h1>Admin Panel</h1>
            <p>Ru'ya | رؤية</p>
          </div>
          <form onSubmit={handleLogin} className="admin-login-form">
            <input
              type="password"
              placeholder="Enter admin password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              className={`admin-input${pwError ? ' admin-input--error' : ''}`}
              autoFocus
            />
            <button type="submit" className="admin-btn admin-btn--primary">
              Access Admin Panel
            </button>
            {pwError && <p className="admin-error">Incorrect password</p>}
          </form>
          <a href="/" className="admin-back">← Back to Ru'ya</a>
        </div>
      </div>
    );
  }

  // ── Admin dashboard ───────────────────────────────────────────────────────────
  return (
    <div className="admin-shell">
      <div className="admin-dashboard">

        {/* Header */}
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Admin Panel</h1>
            <p className="admin-subtitle">Ru'ya | رؤية — Content Management</p>
          </div>
          <a href="/" className="admin-btn admin-btn--ghost">← Back to App</a>
        </div>

        {/* Status cards */}
        <div className="admin-stats-row">
          <div className="admin-stat-card">
            <span className="admin-stat-label">Total Articles</span>
            <span className="admin-stat-value">{articles.length}</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">Last Fetch</span>
            <span className="admin-stat-value">{timeAgo(lastFetch)}</span>
          </div>
          <div className={`admin-stat-card ${isCacheValid() ? 'admin-stat-card--ok' : 'admin-stat-card--warn'}`}>
            <span className="admin-stat-label">Article Cache</span>
            <span className="admin-stat-value">{isCacheValid() ? 'Valid' : 'Expired'}</span>
          </div>
          <div className={`admin-stat-card ${isAICacheValid() ? 'admin-stat-card--ok' : 'admin-stat-card--warn'}`}>
            <span className="admin-stat-label">AI Cache</span>
            <span className="admin-stat-value">{isAICacheValid() ? 'Valid' : 'Expired'}</span>
          </div>
          <div className={`admin-stat-card ${isTranslationCacheValid() ? 'admin-stat-card--ok' : 'admin-stat-card--warn'}`}>
            <span className="admin-stat-label">Translations</span>
            <span className="admin-stat-value">{isTranslationCacheValid() ? 'Cached' : 'Pending'}</span>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="admin-section">
          <h2 className="admin-section-title">Articles per Category</h2>
          <div className="admin-category-grid">
            {Object.entries(TAG_LABELS).filter(([k]) => k !== null).map(([tag, label]) => {
              const count = categoryCounts[tag] || 0;
              const isLow = count < 20;
              return (
                <div key={tag} className={`admin-category-card ${isLow ? 'admin-category-card--low' : 'admin-category-card--ok'}`}>
                  <span className="admin-category-name">{label}</span>
                  <span className="admin-category-count">{count}</span>
                  {isLow && <span className="admin-category-warn">Below 20</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Force Refresh */}
        <div className="admin-section">
          <h2 className="admin-section-title">Force Content Refresh</h2>
          <p className="admin-section-desc">
            Clears all cached data and runs a full pipeline: fetch from all news sources → Gemini AI summaries + tagging → Arabic pre-translation. This uses API quota.
          </p>

          {progress && (
            <div className="admin-progress">
              <div className="admin-progress-spinner" />
              <span>{progress}</span>
            </div>
          )}

          {status === 'success' && !running && (
            <div className="admin-alert admin-alert--success">
              Refresh complete — {articles.length} articles fetched, tagged, and translated.
            </div>
          )}
          {status === 'error' && !running && (
            <div className="admin-alert admin-alert--error">
              {progress || 'Refresh failed — check console for details.'}
            </div>
          )}

          <button
            className="admin-btn admin-btn--danger"
            onClick={handleForceRefresh}
            disabled={running}
          >
            {running ? 'Running...' : 'Force Full Refresh'}
          </button>
        </div>

      </div>
    </div>
  );
}
