// AdminPage.jsx
// Admin control panel at /admin — password protected.
// Triggers the Supabase edge function for a forced content refresh.

import { useState, useEffect } from 'react';
import { getDBStats, triggerFetchNews, triggerTranslateArticles } from '../services/supabaseService.js';

const ADMIN_PASSWORD = 'Taitan12@@4';

const TAG_LABELS = {
  'Vision 2030':           'Vision 2030',
  'AI & Robotics':         'AI & Robotics',
  'NEOM & Giga Projects':  'Giga Projects',
  'Startups':              'Startups',
  'Cybersecurity':         'Cybersecurity',
  'Telecom & 5G':          'Telecom & 5G',
  'Gaming & Entertainment':'Gaming',
  'General':               'General',
  'Untagged':              'Untagged',
};

function timeAgo(iso) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ago`;
  if (h > 0)  return `${h}h ${m}m ago`;
  return `${m}m ago`;
}

export default function AdminPage() {
  const [authed, setAuthed]     = useState(false);
  const [pw, setPw]             = useState('');
  const [pwError, setPwError]   = useState(false);

  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [running, setRunning]         = useState(false);
  const [translating, setTranslating] = useState(false);
  const [result, setResult]           = useState(null);
  const [translateResult, setTranslateResult] = useState(null);
  const [progress, setProgress]       = useState('');

  function handleLogin(e) {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true);
    } else {
      setPwError(true);
      setTimeout(() => setPwError(false), 2000);
    }
  }

  async function loadStats() {
    setLoading(true);
    try {
      const s = await getDBStats();
      setStats(s);
    } catch (e) {
      console.error('[Admin] Failed to load stats:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authed) loadStats();
  }, [authed]);

  async function handleForceRefresh() {
    setRunning(true);
    setResult(null);
    setProgress('Calling Supabase edge function — fetching all news sources…');

    try {
      const res = await triggerFetchNews(ADMIN_PASSWORD);
      setResult({
        success: true,
        message: `Done. ${res.raw} raw → ${res.stored} stored. AI tagged: ${res.ai_tagged}.`,
      });
      await loadStats(); // refresh stats after run
    } catch (e) {
      setResult({ success: false, message: e.message });
    } finally {
      setRunning(false);
      setProgress('');
    }
  }

  // ── Login screen ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="admin-shell">
        <div className="admin-login">
          <div className="admin-logo">
            <img src="/Assets/Logo.webp" alt="Taitan Pulse" style={{ maxHeight: 40, marginBottom: 12 }} onError={e => { e.target.style.display = 'none'; }} />
            <h1>Admin Panel</h1>
            <p>Taitan Pulse</p>
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
          <a href="/" className="admin-back">← Back to Taitan Pulse</a>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  return (
    <div className="admin-shell">
      <div className="admin-dashboard">

        {/* Header */}
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Admin Panel</h1>
            <p className="admin-subtitle">Taitan Pulse — Supabase Content Management</p>
          </div>
          <a href="/" className="admin-btn admin-btn--ghost">← Back to App</a>
        </div>

        {/* Stats row */}
        <div className="admin-stats-row">
          <div className="admin-stat-card">
            <span className="admin-stat-label">Total Articles (DB)</span>
            <span className="admin-stat-value">{loading ? '…' : (stats?.total ?? '–')}</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-label">Last Server Fetch</span>
            <span className="admin-stat-value" style={{ fontSize: 14 }}>
              {stats?.recentRuns?.[0] ? timeAgo(stats.recentRuns[0].ran_at) : '–'}
            </span>
          </div>
          <div className="admin-stat-card admin-stat-card--ok">
            <span className="admin-stat-label">Data Source</span>
            <span className="admin-stat-value" style={{ fontSize: 13 }}>Supabase</span>
          </div>
          <div className="admin-stat-card admin-stat-card--ok">
            <span className="admin-stat-label">Auto Refresh</span>
            <span className="admin-stat-value" style={{ fontSize: 13 }}>Daily 07:00 AST</span>
          </div>
        </div>

        {/* Category breakdown */}
        {stats && (
          <div className="admin-section">
            <h2 className="admin-section-title">Articles per Category</h2>
            <div className="admin-category-grid">
              {Object.entries(TAG_LABELS).map(([tag, label]) => {
                const count = stats.byTag[tag] || 0;
                const isLow = tag !== 'Untagged' && count < 20;
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
        )}

        {/* Recent runs */}
        {stats?.recentRuns?.length > 0 && (
          <div className="admin-section">
            <h2 className="admin-section-title">Recent Fetch Runs</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats.recentRuns.map((run, i) => (
                <div key={i} className="admin-progress" style={{ background: run.status === 'error' ? 'rgba(255,107,53,0.06)' : undefined }}>
                  <span style={{ color: run.status === 'error' ? 'var(--accent-orange)' : 'var(--accent-green)', fontSize: 11 }}>
                    {run.status === 'error' ? '✕' : '✓'}
                  </span>
                  <span style={{ fontSize: 12 }}>
                    {timeAgo(run.ran_at)} — {run.stored} articles stored, {run.ai_tagged} AI tagged
                    {run.error_msg && ` — Error: ${run.error_msg}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Force Refresh */}
        <div className="admin-section">
          <h2 className="admin-section-title">Force Content Refresh</h2>
          <p className="admin-section-desc">
            Triggers the Supabase edge function immediately — fetches all news sources, deduplicates, stores to DB, and runs Gemini tagging on up to 15 untagged articles. Normally this runs automatically every day at 07:00 Riyadh time. Use this only when you want fresh content before the scheduled run.
          </p>

          {running && (
            <div className="admin-progress">
              <div className="admin-progress-spinner" />
              <span>{progress || 'Running… this may take 30–90 seconds.'}</span>
            </div>
          )}

          {result && !running && (
            <div className={`admin-alert ${result.success ? 'admin-alert--success' : 'admin-alert--error'}`}>
              {result.message}
            </div>
          )}

          <button
            className="admin-btn admin-btn--danger"
            onClick={handleForceRefresh}
            disabled={running}
          >
            {running ? 'Running…' : 'Force Full Refresh'}
          </button>

          <button
            className="admin-btn admin-btn--ghost"
            onClick={loadStats}
            disabled={loading}
            style={{ marginTop: 0 }}
          >
            {loading ? 'Loading…' : 'Refresh Stats'}
          </button>
        </div>

        {/* Arabic Translation */}
        <div className="admin-section">
          <h2 className="admin-section-title">Arabic Translation</h2>
          <p className="admin-section-desc">
            Translates up to 40 untranslated articles to Arabic via Gemini and stores the result permanently in the database. Run this multiple times until all articles are translated. Each article is only ever translated once.
          </p>

          {translating && (
            <div className="admin-progress">
              <div className="admin-progress-spinner" />
              <span>Translating up to 40 articles… takes ~60 seconds.</span>
            </div>
          )}

          {translateResult && !translating && (
            <div className={`admin-alert ${translateResult.success ? 'admin-alert--success' : 'admin-alert--error'}`}>
              {translateResult.message}
            </div>
          )}

          <button
            className="admin-btn admin-btn--primary"
            onClick={async () => {
              setTranslating(true);
              setTranslateResult(null);
              try {
                const res = await triggerTranslateArticles(ADMIN_PASSWORD);
                setTranslateResult({
                  success: res.translated > 0,
                  message: res.message || `Translated ${res.translated} articles. Failed: ${res.failed}.${res.lastError ? ' Error: ' + res.lastError : ''}`,
                });
                await loadStats();
              } catch (e) {
                setTranslateResult({ success: false, message: e.message });
              } finally {
                setTranslating(false);
              }
            }}
            disabled={translating || running}
          >
            {translating ? 'Translating…' : 'Translate to Arabic (40 articles)'}
          </button>
        </div>

      </div>
    </div>
  );
}
