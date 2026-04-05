// NewsViewport.jsx
// Vertical scrolling news feed with IntersectionObserver scroll-reveal per card.
// No more horizontal snap or robot overlay — robot lives in HeroSection now.

import { useEffect, useRef } from 'react';
import HeroCard from './HeroCard.jsx';
import NewsCard from './NewsCard.jsx';
import SkeletonCard from './SkeletonCard.jsx';

export default function NewsViewport({ articles, loading, language }) {
  const feedRef = useRef(null);

  // For cards below the fold, add card-appeared when they scroll into view
  useEffect(() => {
    if (loading || articles.length === 0) return;
    const feed = feedRef.current;
    if (!feed) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('card-appeared');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px 100px 0px' }
    );

    // Only observe wraps that don't already have the class (below-fold cards)
    const id = setTimeout(() => {
      feed.querySelectorAll('.feed-card-wrap:not(.card-appeared)').forEach(w => observer.observe(w));
    }, 50);

    return () => { clearTimeout(id); observer.disconnect(); };
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
          className="feed-card-wrap card-appeared"
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
