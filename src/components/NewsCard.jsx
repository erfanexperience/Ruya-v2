// NewsCard.jsx
// layout="horizontal" → image 30% left, content 70% right
// layout="vertical"   → default stacked layout
// Arabic translations served from DB (title_ar / summary_ar) — no on-demand API calls

import { useState, useRef, useEffect } from 'react';
import { timeAgo, truncate, getFallbackImage, staggerDelay } from '../utils/helpers.js';

export default function NewsCard({ article, index = 0, language = 'en', size = 'normal', layout = 'vertical', onSelect }) {
  const [isFlipped, setIsFlipped]   = useState(false);
  const [imgLoaded, setImgLoaded]   = useState(false);
  const [imgError, setImgError]     = useState(false);

  const cardRef    = useRef(null);
  const magnetRef  = useRef({ x: 0, y: 0, rafId: null });

  const isArabic     = language === 'ar';
  const isHorizontal = layout === 'horizontal';
  const isWide       = size === 'wide';

  // Pick the right language content — fall back to English if Arabic not yet translated
  const title   = isArabic ? (article.title_ar   || article.title)   : article.title;
  const summary = isArabic ? (article.summary_ar  || article.summary) : article.summary;
  // Flip side shows the other language
  const flipTitle   = isArabic ? article.title   : (article.title_ar   || article.title);
  const flipSummary = isArabic ? article.summary  : (article.summary_ar || article.summary);

  const source      = article.source      || '';
  const tag         = article.tag         || '';
  const image       = article.image       || getFallbackImage(article.title);
  const publishedAt = article.publishedAt;

  // Flip label
  const flipLabel = isFlipped
    ? (isArabic ? 'رجوع' : 'Back')
    : (isArabic ? 'EN' : 'AR');

  const hasOtherLang = isArabic ? !!article.title_ar : !!article.title_ar;

  // Magnetic effect
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    function onMouseMove(e) {
      const rect = card.getBoundingClientRect();
      magnetRef.current.targetX = ((e.clientX - rect.left - rect.width / 2) / rect.width) * 6;
      magnetRef.current.targetY = ((e.clientY - rect.top - rect.height / 2) / rect.height) * 6;
    }
    function onMouseLeave() { magnetRef.current.targetX = 0; magnetRef.current.targetY = 0; }
    function animateMagnet() {
      const m = magnetRef.current;
      m.x = m.x + ((m.targetX || 0) - m.x) * 0.12;
      m.y = m.y + ((m.targetY || 0) - m.y) * 0.12;
      if (card) card.style.transform = `translate(${m.x}px, ${m.y}px)`;
      m.rafId = requestAnimationFrame(animateMagnet);
    }
    card.addEventListener('mousemove', onMouseMove, { passive: true });
    card.addEventListener('mouseleave', onMouseLeave, { passive: true });
    magnetRef.current.rafId = requestAnimationFrame(animateMagnet);
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

  function handleFlip(e) {
    e.stopPropagation();
    setIsFlipped(f => !f);
  }

  const cardClass = [
    'card news-card flicker',
    isWide       ? 'news-card--wide'       : '',
    isHorizontal ? 'news-card--horizontal' : '',
  ].filter(Boolean).join(' ');

  // ── HORIZONTAL layout ──────────────────────────────────────────────────────
  if (isHorizontal) {
    return (
      <div
        ref={cardRef}
        className={cardClass}
        style={{ animationDelay: staggerDelay(index, 100), cursor: 'pointer', direction: isArabic ? 'rtl' : 'ltr' }}
        onClick={handleCardClick}
      >
        <div className={`news-card-flip${isFlipped ? ' flipped' : ''}`}>
          {/* FRONT */}
          <div className="news-card-front news-card-front--h">
            {!imgError && (
              <div className="news-card-img-h">
                <img
                  src={image}
                  loading="lazy"
                  className={`news-card-image${imgLoaded ? ' loaded' : ''}`}
                  alt={title}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgError(true)}
                />
              </div>
            )}
            <div className="news-card-content-h">
              <div className="news-card-body">
                <div className="news-card-meta">
                  <span className="news-card-source">{source}</span>
                  <span className="news-card-time">{timeAgo(publishedAt)}</span>
                </div>
                {tag && <span className="news-card-tag">{tag}</span>}
                <h3 className="news-card-title">{title}</h3>
                <p className="news-card-summary">{truncate(summary, 160)}</p>
              </div>
            </div>
          </div>
          {/* BACK — other language */}
          <div className="news-card-back" style={{ direction: isArabic ? 'ltr' : 'rtl' }}>
            <p className="translated-title">{flipTitle}</p>
            <p className="translated-summary">{truncate(flipSummary, 200)}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── VERTICAL layout ────────────────────────────────────────────────────────
  return (
    <div
      ref={cardRef}
      className={cardClass}
      style={{ animationDelay: staggerDelay(index, 100), cursor: 'pointer', direction: isArabic ? 'rtl' : 'ltr' }}
      onClick={handleCardClick}
    >
      <div className={`news-card-flip${isFlipped ? ' flipped' : ''}`}>
        {/* FRONT */}
        <div className="news-card-front">
          {!imgError && (
            <div className="news-card-image-wrap">
              <img
                src={image}
                loading="lazy"
                className={`news-card-image${imgLoaded ? ' loaded' : ''}`}
                alt={title}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
              <div className="news-card-image-overlay" />
            </div>
          )}
          <div className="news-card-body">
            <div className="news-card-meta">
              <span className="news-card-source">{source}</span>
              <span className="news-card-time">{timeAgo(publishedAt)}</span>
            </div>
            {tag && <span className="news-card-tag">{tag}</span>}
            <h3 className="news-card-title">{title}</h3>
            <p className="news-card-summary">{truncate(summary, isWide ? 220 : 140)}</p>
          </div>
        </div>
        {/* BACK — other language */}
        <div className="news-card-back" style={{ direction: isArabic ? 'ltr' : 'rtl' }}>
          <p className="translated-title">{flipTitle}</p>
          <p className="translated-summary">{truncate(flipSummary, 220)}</p>
        </div>
      </div>
    </div>
  );
}
