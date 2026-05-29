// ArticleModal.jsx
// Full-screen article detail overlay shown when a card is clicked.

import { useEffect, useState } from 'react';
import { timeAgo, getFallbackImage } from '../utils/helpers.js';
import { generateTaitanTake, translateTaitanTake } from '../services/geminiService.js';

export default function ArticleModal({ article, language, onClose }) {
  const isArabic = language === 'ar';

  const title       = isArabic ? (article.title_ar   || article.title   || '') : (article.title   || '');
  const summary     = isArabic ? (article.summary_ar  || article.summary || article.description || '') : (article.summary || article.description || '');
  const source      = article.source      || '';
  const tag         = article.tag         || '';
  const url         = article.url         || '#';
  const image       = article.image       || getFallbackImage(article.title || '');
  const publishedAt = article.publishedAt;

  const [take, setTake]               = useState(article.taitanTake || null);
  const [takeLoading, setTakeLoading] = useState(!article.taitanTake);
  const [takeAr, setTakeAr]           = useState(null);
  const [takeArLoading, setTakeArLoading] = useState(false);

  // Step 1 — fetch English Take (from article object or on-demand)
  useEffect(() => {
    if (article.taitanTake) { setTake(article.taitanTake); setTakeLoading(false); return; }
    let cancelled = false;
    generateTaitanTake(article)
      .then(t => { if (!cancelled) { setTake(t || null); setTakeLoading(false); } })
      .catch(() => { if (!cancelled) setTakeLoading(false); });
    return () => { cancelled = true; };
  }, [article]);

  // Step 2 — when Arabic mode and English Take is ready, fetch Arabic translation
  useEffect(() => {
    if (!isArabic || !take) return;
    let cancelled = false;
    setTakeArLoading(true);
    translateTaitanTake(take, article.url)
      .then(t => { if (!cancelled) { setTakeAr(t || null); setTakeArLoading(false); } })
      .catch(() => { if (!cancelled) setTakeArLoading(false); });
    return () => { cancelled = true; };
  }, [isArabic, take, article.url]);

  // Displayed take: Arabic translation when ready, fall back to English
  const displayTake     = isArabic ? (takeAr || take) : take;
  const displayLoading  = isArabic ? (takeLoading || takeArLoading) : takeLoading;

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="article-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="article-modal"
        onClick={e => e.stopPropagation()}
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Close button */}
        <button className="article-modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Hero image */}
        <div className="article-modal-hero">
          <img src={image} alt={title} className="article-modal-hero-img"
            onError={e => { e.target.style.display = 'none'; }} />
          <div className="article-modal-hero-overlay" />

          {/* Meta pills on top of image */}
          <div className="article-modal-hero-meta">
            {tag && <span className="article-modal-tag">{tag}</span>}
          </div>
        </div>

        {/* Content */}
        <div className="article-modal-body">
          <div className="article-modal-source-row">
            <span className="article-modal-source">{source}</span>
            <span className="article-modal-time">{timeAgo(publishedAt)}</span>
          </div>

          <h1 className="article-modal-title">{title}</h1>

          <div className="article-modal-divider" />

          {/* Summary / description */}
          <div className="article-modal-content">
            {summary
              ? summary.split('\n').filter(Boolean).map((para, i) => (
                  <p key={i} className="article-modal-para">{para}</p>
                ))
              : <p className="article-modal-para article-modal-para--muted">
                  {isArabic ? 'لا يوجد محتوى متاح.' : 'No content available for this article.'}
                </p>
            }
          </div>

          {/* Taitan Take */}
          {(displayTake || displayLoading) && (
            <div className="taitan-take">
              <div className="taitan-take-header">
                <span className="taitan-take-label">
                  {isArabic ? 'رأي تايتان' : 'TAITAN TAKE'}
                </span>
                <div className="taitan-take-line" />
              </div>
              {displayLoading ? (
                <div className="taitan-take-loading">
                  <span className="taitan-take-shimmer" />
                  <span className="taitan-take-shimmer taitan-take-shimmer--mid" />
                  <span className="taitan-take-shimmer taitan-take-shimmer--short" />
                </div>
              ) : (
                <p className="taitan-take-body">{displayTake}</p>
              )}
            </div>
          )}

          {/* Read more link */}
          <div className="article-modal-footer">
            <div className="article-modal-footer-line" />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="article-modal-read-more"
            >
              <span>{isArabic ? 'اقرأ المقال كاملاً على' : 'Read full article at'}</span>
              <span className="article-modal-read-more-source">{source}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
