// HeroCard.jsx
// Large hero card — 40% viewport width, full viewport height
// Same flip/translate/magnetic behavior as NewsCard, but bigger

import { useState, useRef, useEffect, useCallback } from 'react';
import { translateArticle } from '../services/geminiService.js';
import { timeAgo, getFallbackImage } from '../utils/helpers.js';

export default function HeroCard({ article, language = 'en', onSelect }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [translated, setTranslated] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

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

  const targetLang = language === 'ar' ? 'Arabic' : 'English';

  // Lazy image
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          img.src = image;
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(img);
    return () => observer.disconnect();
  }, [image]);

  // Magnetic movement (softer on hero)
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    function onMouseMove(e) {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      magnetRef.current.targetX = ((e.clientX - cx) / rect.width) * 4;
      magnetRef.current.targetY = ((e.clientY - cy) / rect.height) * 4;
    }
    function onMouseLeave() {
      magnetRef.current.targetX = 0;
      magnetRef.current.targetY = 0;
    }
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

  function handleCardClick(e) {
    if (e.target.closest('button, a')) return;
    if (onSelect) onSelect(article);
  }

  const handleTranslate = useCallback(async (e) => {
    e.stopPropagation();
    if (isFlipped) { setIsFlipped(false); return; }
    setIsFlipped(true);
    if (!translated) {
      setTranslating(true);
      try {
        const result = await translateArticle({ ...article, summary }, targetLang);
        setTranslated(result);
      } catch {
        setTranslated({ title, summary: 'Translation unavailable.' });
      } finally {
        setTranslating(false);
      }
    }
  }, [isFlipped, translated, article, summary, targetLang, title]);

  return (
    <div
      ref={cardRef}
      className="card hero-card flicker"
      style={{ animationDelay: '0ms', cursor: 'pointer' }}
      onClick={handleCardClick}
    >
      <div className={`news-card-flip${isFlipped ? ' flipped' : ''}`} style={{ flex: 1 }}>
        {/* FRONT */}
        <div className="news-card-front">
          <div className="news-card-image-wrap">
            <span className="hero-label">
              {language === 'ar' ? 'الخبر الرئيسي' : 'TOP STORY'}
            </span>
            <img
              ref={imgRef}
              className={`news-card-image${imgLoaded ? ' loaded' : ''}`}
              alt={title}
              onLoad={() => setImgLoaded(true)}
              onError={(e) => {
                e.target.src = getFallbackImage('hero' + title.slice(0, 10));
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

        {/* BACK */}
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
