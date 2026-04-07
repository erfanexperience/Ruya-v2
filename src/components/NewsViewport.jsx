// NewsViewport.jsx
// Above-fold: 60% hero + 40% first card. Below: bento grid with unequal card sizes.

import { useEffect, useRef } from 'react';
import HeroSection from './HeroSection.jsx';
import HeroCard from './HeroCard.jsx';
import NewsCard from './NewsCard.jsx';
import SkeletonCard from './SkeletonCard.jsx';

// Bento size pattern — repeating every 7 cards (CSS nth-child handles this)
// Sizes: 'wide'=2col, 'tall'=1col tall, 'sm'=1col, 'banner'=3col, 'md'=2col
// We assign a data-bento-index for CSS to pattern against
function BentoCard({ article, index, globalIndex, language, onArticleSelect }) {
  return (
    <div
      className="bento-wrap"
      data-bento={index % 7}
      style={{ '--card-index': globalIndex }}
    >
      <NewsCard
        article={article}
        index={globalIndex}
        language={language}
        size="normal"
        layout="vertical"
        onSelect={onArticleSelect}
      />
    </div>
  );
}

export default function NewsViewport({ articles, loading, language, activeTopic, onArticleSelect }) {
  const feedRef = useRef(null);
  const showHero = activeTopic === 'all';

  // IntersectionObserver — add card--visible when card enters viewport
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('card--visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: '0px 0px 60px 0px' }
    );

    feed.querySelectorAll('.card:not(.card--visible)').forEach(c => observer.observe(c));
    return () => observer.disconnect();
  }, [articles, loading]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="viewport-shell" ref={feedRef}>
        <div className={`above-fold${showHero ? '' : ' above-fold--parked'}`}>
          <div className="above-fold-hero">
            <HeroSection language={language} />
          </div>
          <div className="fold-card-slot">
            <div className="bento-wrap" data-bento="0">
              <SkeletonCard isHero index={0} />
            </div>
          </div>
        </div>
        <div className="bento-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="bento-wrap" data-bento={i % 7} key={i}>
              <SkeletonCard index={i + 1} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (articles.length === 0) {
    return (
      <div className="viewport-shell viewport-shell--empty" ref={feedRef}>
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {language === 'ar' ? 'لا توجد مقالات في هذه الفئة' : 'No articles in this category'}
        </div>
      </div>
    );
  }

  const firstArticle = articles[0];
  const restArticles = articles.slice(1);

  // ── Normal render ──────────────────────────────────────────────────────────
  return (
    <div className="viewport-shell" ref={feedRef}>

      {/* Above-fold row: always mounted so Spline never unmounts/replays.
          Hidden via CSS when not on the 'all' tab. */}
      <div className={`above-fold${showHero ? '' : ' above-fold--parked'}`}>
        <div className="above-fold-hero">
          <HeroSection language={language} />
        </div>
        <div className="fold-card-slot" style={{ '--card-index': 0 }}>
          <HeroCard article={firstArticle} language={language} onSelect={onArticleSelect} />
        </div>
      </div>

      {/* Bento grid — all articles, or from index 1 if hero is visible */}
      <div className="bento-grid">
        {(showHero ? restArticles : articles).map((article, i) => (
          <BentoCard
            key={article.id || article.url || i}
            article={article}
            index={i}
            globalIndex={showHero ? i + 1 : i}
            language={language}
            onArticleSelect={onArticleSelect}
          />
        ))}
      </div>

    </div>
  );
}
