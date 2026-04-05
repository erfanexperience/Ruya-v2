// App.jsx — TAITAN Pulse
// Layout: fixed header → sticky topic nav → hero section → vertical news feed

import { useState } from 'react';
import './styles.css';
import ParticleBackground from './components/ParticleBackground.jsx';
import Header from './components/Header.jsx';
import TopicNav from './components/TopicNav.jsx';
import HeroSection from './components/HeroSection.jsx';
import NewsViewport from './components/NewsViewport.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import { useNews } from './hooks/useNews.js';
import { useLanguage } from './hooks/useLanguage.js';

export default function App() {
  const { language, toggleLanguage } = useLanguage();
  const [showApp, setShowApp] = useState(false);

  const {
    articles,
    loading,
    error,
    activeTopic,
    setActiveTopic,
  } = useNews();

  return (
    <>
      {/* Loading screen */}
      {!showApp && (
        <LoadingScreen
          isReady={!loading}
          onDone={() => setShowApp(true)}
        />
      )}

      {/* Fixed background layers */}
      <div className="bg-grid" aria-hidden="true" />
      <ParticleBackground />

      {/* App shell */}
      <div className={`app${showApp ? ' app--visible' : ''}`} style={{ visibility: showApp ? 'visible' : 'hidden' }}>

        {/* Fixed header */}
        <Header
          language={language}
          onToggleLanguage={toggleLanguage}
        />

        {/* Sticky topic nav */}
        <TopicNav
          activeTopic={activeTopic}
          onTopicChange={setActiveTopic}
          language={language}
        />

        {/* Hero — only on "all" tab */}
        {activeTopic === 'all' && (
          <HeroSection language={language} />
        )}

        {/* Vertical news feed */}
        {error ? (
          <div className="empty-state" style={{ minHeight: '40vh', color: 'var(--accent-orange)' }}>
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
          />
        )}
      </div>
    </>
  );
}
