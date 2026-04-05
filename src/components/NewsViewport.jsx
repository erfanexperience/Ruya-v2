// NewsViewport.jsx
// Vertical scrolling news feed with IntersectionObserver scroll-reveal per card.
// No more horizontal snap or robot overlay — robot lives in HeroSection now.

import { useEffect, useRef } from 'react';
import HeroCard from './HeroCard.jsx';
import NewsCard from './NewsCard.jsx';
import SkeletonCard from './SkeletonCard.jsx';

export default function NewsViewport({ articles, loading, language }) {
  const feedRef = useRef(null);

  // Scroll-reveal: watch every .card and add .card--visible when it enters viewport
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('card--visible');
            observer.unobserve(entry.target); // fire once
          }
        });
      },
      { threshold: 0.08 }
    );

    const cards = feed.querySelectorAll('.card');
    cards.forEach(card => observer.observe(card));

    return () => observer.disconnect();
  }, [articles, loading]);

  // Re-run observer when new cards appear after articles load
  useEffect(() => {
    if (loading) return;
    const feed = feedRef.current;
    if (!feed) return;

    // Small delay to let DOM settle
    const id = setTimeout(() => {
      const observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('card--visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08 }
      );
      feed.querySelectorAll('.card:not(.card--visible)').forEach(c => observer.observe(c));
      return () => observer.disconnect();
    }, 100);

    return () => clearTimeout(id);
  }, [articles, loading]);

  if (loading) {
    return (
      <div className="news-feed" ref={feedRef}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div className="feed-card-wrap" key={i}>
            <SkeletonCard isHero={i === 0} index={i} />
          </div>
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="news-feed news-feed--empty">
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          {language === 'ar' ? 'لا توجد مقالات في هذه الفئة' : 'No articles in this category'}
        </div>
      </div>
    );
  }

  return (
    <div className="news-feed" ref={feedRef}>
      {articles.map((article, index) => (
        <div
          className="feed-card-wrap"
          key={article.id || article.url || index}
          style={{ '--card-index': index }}
        >
          {index === 0
            ? <HeroCard article={article} language={language} />
            : <NewsCard
                article={article}
                index={index}
                language={language}
                size="normal"
                layout="vertical"
              />
          }
        </div>
      ))}
    </div>
  );
}
