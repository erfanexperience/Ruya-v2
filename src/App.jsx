// App.jsx
// Root layout — wires together all hooks, components, background

import { useState } from 'react';
import './styles.css';
import ParticleBackground from './components/ParticleBackground.jsx';
import Header from './components/Header.jsx';
import TopicNav from './components/TopicNav.jsx';
import NewsViewport from './components/NewsViewport.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import { useNews } from './hooks/useNews.js';
import { useLanguage } from './hooks/useLanguage.js';

export default function App() {
  const { language, toggleLanguage } = useLanguage();
  const [showApp, setShowApp] = useState(false);

  // News fetching starts immediately — in the background while loading screen shows
  const {
    articles,
    loading,
    error,
    activeTopic,
    setActiveTopic,
    articleCount,
    lastFetchTime,
  } = useNews();

  return (
    <>
      {/* Loading screen — stays for ≥3s, fades out when news is ready */}
      {!showApp && (
        <LoadingScreen
          isReady={!loading}
          onDone={() => setShowApp(true)}
        />
      )}

      {/* Fixed background layers — always rendered so they're ready */}
      <div className="bg-grid" aria-hidden="true" />
      <ParticleBackground />

      {/* App shell — rendered in background immediately, visible after loading */}
      <div className={`app${showApp ? ' app--visible' : ''}`} style={{ visibility: showApp ? 'visible' : 'hidden' }}>
        <Header
          language={language}
          onToggleLanguage={toggleLanguage}
          articleCount={articleCount}
          lastFetchTime={lastFetchTime}
        />

        <TopicNav
          activeTopic={activeTopic}
          onTopicChange={setActiveTopic}
          language={language}
        />

        {error ? (
          <div className="empty-state" style={{ color: 'var(--accent-orange)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {language === 'ar'
              ? 'فشل تحميل الأخبار — تحقق من اتصالك'
              : 'Failed to load news — check your connection'}
          </div>
        ) : (
          <NewsViewport
            articles={articles}
            loading={loading}
            language={language}
            activeTopic={activeTopic}
          />
        )}
      </div>
    </>
  );
}
