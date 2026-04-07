// HeroCard.jsx — Large hero card
// Arabic translations served from DB — no on-demand API calls

import { useState, useRef, useEffect } from 'react';
import { timeAgo, getFallbackImage } from '../utils/helpers.js';

export default function HeroCard({ article, language = 'en', onSelect }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const cardRef   = useRef(null);
  const imgRef    = useRef(null);
  const magnetRef = useRef({ x: 0, y: 0, rafId: null });

  const isArabic = language === 'ar';

  const title   = isArabic ? (article.title_ar   || article.title)   : article.title;
  const summary = isArabic ? (article.summary_ar  || article.summary) : article.summary;
  const flipTitle   = isArabic ? article.title   : (article.title_ar   || article.title);
  const flipSummary = isArabic ? article.summary  : (article.summary_ar || article.summary);

  const source      = article.source      || '';
  const tag         = article.tag         || '';
  const url         = article.url         || '#';
  const image       = article.image       || getFallbackImage(article.title);
  const publishedAt = article.publishedAt;

  // Lazy image
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { img.src = image; observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(img);
    return () => observer.disconnect();
  }, [image]);

  // Magnetic movement
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    function onMouseMove(e) {
      const rect = card.getBoundingClientRect();
      magnetRef.current.targetX = ((e.clientX - rect.left - rect.width / 2) / rect.width) * 4;
      magnetRef.current.targetY = ((e.clientY - rect.top - rect.height / 2) / rect.height) * 4;
    }
    function onMouseLeave() { magnetRef.current.targetX = 0; magnetRef.current.targetY = 0; }
    function animate() {
      const m = magnetRef.current;
      m.x = m.x + ((m.targetX || 0) - m.x) * 0.10;
      m.y = m.y + ((m.targetY || 0) - m.y) * 0.10;
      if (card) card.style.transform = `translate(${m.x}px, ${m.y}px)`;
      m.rafId = requestAnimationFrame(animate);
    }
    card.addEventListener('mousemove', onMouseMove, { passive: true });
    card.addEventListener('mouseleave', onMouseLeave, { passive: true });
    magnetRef.current.rafId = requestAnimationFrame(animate);
    return () => {
      card.removeEventListener('mousemove', onMouseMove);
      card.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(magnetRef.current.rafId);
      if (card) card.style.transform = '';
    };
  }, []);

  // Reset flip when language changes
  useEffect(() => { setIsFlipped(false); }, [language]);

  function handleCardClick(e) {
    if (e.target.closest('button, a')) return;
    if (onSelect) onSelect(article);
  }

  return (
    <div
      ref={cardRef}
      className="card hero-card flicker"
      style={{ animationDelay: '0ms', cursor: 'pointer', direction: isArabic ? 'rtl' : 'ltr' }}
      onClick={handleCardClick}
    >
      <div className={`news-card-flip${isFlipped ? ' flipped' : ''}`} style={{ flex: 1 }}>
        {/* FRONT */}
        <div className="news-card-front">
          <div className="news-card-image-wrap">
            <span className="hero-label">
              {isArabic ? 'الخبر الرئيسي' : 'TOP STORY'}
            </span>
            <img
              ref={imgRef}
              className={`news-card-image${imgLoaded ? ' loaded' : ''}`}
              alt={title}
              onLoad={() => setImgLoaded(true)}
              onError={(e) => {
                e.target.src = getFallbackImage('hero' + article.title.slice(0, 10));
                setImgLoaded(true);
              }}
            />
            <div className="news-card-image-overlay" />
          </div>
          <div className="news-card-body">
            <div className="news-card-meta">
              <span className="news-card-source">{source}</span>
              <span className="news-card-time">{timeAgo(publishedAt)}</span>
            </div>
            {tag && <span className="news-card-tag">{tag}</span>}
            <h2 className="news-card-title">{title}</h2>
            <p className="news-card-summary">{summary}</p>
          </div>
        </div>

        {/* BACK — other language */}
        <div className="news-card-back" style={{ direction: isArabic ? 'ltr' : 'rtl' }}>
          <p className="translated-title">{flipTitle}</p>
          <p className="translated-summary">{flipSummary}</p>
        </div>
      </div>
    </div>
  );
}
