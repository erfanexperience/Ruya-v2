// NewsCard.jsx
// layout="horizontal" → image 30% left, content 70% right (for short bento slots)
// layout="vertical"   → default stacked layout

import { useState, useRef, useEffect, useCallback } from 'react';
import { translateArticle } from '../services/geminiService.js';
import { timeAgo, truncate, getFallbackImage, staggerDelay } from '../utils/helpers.js';

export default function NewsCard({ article, index = 0, language = 'en', size = 'normal', layout = 'vertical' }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [translated, setTranslated] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hasFlickered, setHasFlickered] = useState(false);

  const cardRef = useRef(null);
  const imgRef = useRef(null);
  const magnetRef = useRef({ x: 0, y: 0, rafId: null });

  const title = article.title || '';
  const summary = article.summary || article.description || '';
  const source = article.source || '';
  const tag = article.tag || '';
  const url = article.url || '#';
  const image = article.image || getFallbackImage(title);
  const publishedAt = article.publishedAt;
  const isHorizontal = layout === 'horizontal';
  const isWide = size === 'wide';

  const targetLang = language === 'ar' ? 'Arabic' : 'English';

  useEffect(() => {
    if (!hasFlickered) {
      const timer = setTimeout(() => setHasFlickered(true), 50);
      return () => clearTimeout(timer);
    }
  }, [hasFlickered]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { img.src = image; observer.disconnect(); }
      },
      { rootMargin: '200px' }
    );
    observer.observe(img);
    return () => observer.disconnect();
  }, [image]);

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

  const handleTranslate = useCallback(async (e) => {
    e.stopPropagation();
    if (isFlipped) { setIsFlipped(false); return; }
    setIsFlipped(true);
    if (!translated) {
      setTranslating(true);
      try {
        const result = await translateArticle({ ...article, summary }, targetLang);
        setTranslated(result);
      } catch (err) {
        console.warn('[Ruya] Translation error:', err.message);
        setTranslated({ title, summary: 'Translation unavailable.' });
      } finally {
        setTranslating(false);
      }
    }
  }, [isFlipped, translated, article, summary, targetLang, title]);

  const flipLabel = isFlipped
    ? (language === 'ar' ? 'رجوع' : 'Back')
    : (language === 'ar' ? 'ترجمة EN' : 'Translate AR');

  const cardClass = [
    'card news-card',
    hasFlickered ? 'flicker' : '',
    isWide ? 'news-card--wide' : '',
    isHorizontal ? 'news-card--horizontal' : '',
  ].filter(Boolean).join(' ');

  function handleCardClick(e) {
    // Don't navigate if user clicked a button or a link inside
    if (e.target.closest('button, a')) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // ── HORIZONTAL layout (30/70) ──────────────────────────────────────
  if (isHorizontal) {
    return (
      <div
        ref={cardRef}
        className={cardClass}
        style={{ animationDelay: staggerDelay(index, 100), cursor: 'pointer' }}
        onClick={handleCardClick}
      >
        <div className={`news-card-flip${isFlipped ? ' flipped' : ''}`}>
          {/* FRONT */}
          <div className="news-card-front news-card-front--h">
            {/* Image — 30% */}
            <div className="news-card-img-h">
              <img
                ref={imgRef}
                className={`news-card-image${imgLoaded ? ' loaded' : ''}`}
                alt={title}
                onLoad={() => setImgLoaded(true)}
                onError={(e) => { e.target.src = getFallbackImage(title + index); setImgLoaded(true); }}
              />
            </div>
            {/* Content — 70% */}
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

          {/* BACK — translated */}
          <div className="news-card-back">
            {translating ? (
              <div className="translation-spinner">
                {language === 'ar' ? 'جارٍ الترجمة...' : 'Translating...'}
              </div>
            ) : translated ? (
              <>
                <p className="translated-title">{translated.title}</p>
                <p className="translated-summary">{translated.summary}</p>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // ── VERTICAL layout (default) ──────────────────────────────────────
  return (
    <div
      ref={cardRef}
      className={cardClass}
      style={{ animationDelay: staggerDelay(index, 100), cursor: 'pointer' }}
      onClick={handleCardClick}
    >
      <div className={`news-card-flip${isFlipped ? ' flipped' : ''}`}>
        {/* FRONT */}
        <div className="news-card-front">
          <div className="news-card-image-wrap">
            <img
              ref={imgRef}
              className={`news-card-image${imgLoaded ? ' loaded' : ''}`}
              alt={title}
              onLoad={() => setImgLoaded(true)}
              onError={(e) => { e.target.src = getFallbackImage(title + index); setImgLoaded(true); }}
            />
            <div className="news-card-image-overlay" />
          </div>
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

        {/* BACK — translated */}
        <div className="news-card-back">
          {translating ? (
            <div className="translation-spinner">
              {language === 'ar' ? 'جارٍ الترجمة...' : 'Translating...'}
            </div>
          ) : translated ? (
            <>
              <p className="translated-title">{translated.title}</p>
              <p className="translated-summary">{translated.summary}</p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
