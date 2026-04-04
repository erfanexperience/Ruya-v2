// NewsViewport.jsx
// Robot panel is rendered OUTSIDE the scroll container, positioned absolutely
// over a placeholder slot — so it never moves when pages scroll.
// RobotPanel is NEVER unmounted after first mount so Spline only plays once.

import { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import HeroCard from './HeroCard.jsx';
import NewsCard from './NewsCard.jsx';
import SkeletonCard from './SkeletonCard.jsx';
import RobotPanel from './RobotPanel.jsx';

const CARDS_PER_PAGE = 6; // hero + card2 + card3 + card4a + card4b + card5
const SLOT_AREAS = ['hero', 'card2', 'card3', 'card4a', 'card4b', 'card5'];

// Module-level flag — resets on every full page load, never on tab/language switches
let _robotIntroPlayed = false;

function chunkArticles(articles) {
  const pages = [];
  for (let i = 0; i < articles.length; i += CARDS_PER_PAGE) {
    pages.push(articles.slice(i, i + CARDS_PER_PAGE));
  }
  return pages;
}

export default function NewsViewport({ articles, loading, language, activeTopic }) {
  const viewportRef  = useRef(null);
  const wrapperRef   = useRef(null);
  const robotSlotRef = useRef(null); // placeholder on page 0
  const [progress, setProgress] = useState(0);
  const [robotPos, setRobotPos] = useState(null);

  // True only on the very first mount this session — drives the emerge animation
  const [robotIntro] = useState(() => {
    if (_robotIntroPlayed) return false;
    _robotIntroPlayed = true;
    return true;
  });

  const pages = chunkArticles(articles);
  const isEmpty = !loading && articles.length === 0;

  // ── Measure the robot placeholder and position the overlay ──────────
  function measureRobot() {
    const slot    = robotSlotRef.current;
    const wrapper = wrapperRef.current;
    if (!slot || !wrapper) return;
    const sr = slot.getBoundingClientRect();
    const wr = wrapper.getBoundingClientRect();
    setRobotPos({
      left:   sr.left - wr.left,
      top:    sr.top  - wr.top,
      width:  sr.width,
      height: sr.height,
    });
  }

  useLayoutEffect(() => {
    measureRobot();
    const ro = new ResizeObserver(measureRobot);
    if (robotSlotRef.current) ro.observe(robotSlotRef.current);
    window.addEventListener('resize', measureRobot, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureRobot);
    };
  }, [articles.length, loading, language]);

  // ── Scroll progress bar ──────────────────────────────────────────────
  const updateProgress = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setProgress(maxScroll > 0 ? (el.scrollLeft / maxScroll) * 100 : 0);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateProgress, { passive: true });
    return () => el.removeEventListener('scroll', updateProgress);
  }, [updateProgress]);

  useEffect(() => {
    const el = viewportRef.current;
    if (el) { el.scrollTo({ left: 0, behavior: 'instant' }); setProgress(0); }
  }, [articles]);

  function scrollBy(direction) {
    const el = viewportRef.current;
    if (!el) return;
    // In RTL the viewport has direction:rtl so scrollLeft is already flipped by the browser
    const rtl = language === 'ar';
    el.scrollBy({ left: (rtl ? -direction : direction) * el.clientWidth, behavior: 'smooth' });
  }

  // ── Skeleton pages (rendered when loading) ───────────────────────────
  function renderSkeleton() {
    return [0, 1].map(pageIdx => (
      <div className="viewport-page" key={`skel-${pageIdx}`}>
        {SLOT_AREAS.map((area, i) => (
          <div key={area} style={{ gridArea: area }}>
            <SkeletonCard isHero={area === 'hero'} index={pageIdx * 6 + i} />
          </div>
        ))}
        {/* Robot placeholder — give ref so we can measure position during loading */}
        <div
          style={{ gridArea: 'robot', pointerEvents: 'none' }}
          ref={pageIdx === 0 ? robotSlotRef : null}
        />
      </div>
    ));
  }

  // ── Article pages ────────────────────────────────────────────────────
  function renderArticles() {
    return pages.map((pageArticles, pageIdx) => (
      <div
        className="viewport-page"
        key={`page-${pageIdx}`}
        style={{ animationDelay: `${pageIdx * 40}ms` }}
      >
        {pageArticles.map((article, slotIdx) => {
          const area = SLOT_AREAS[slotIdx];
          if (!area) return null;
          return (
            <div key={article.id || article.url || slotIdx} style={{ gridArea: area, minHeight: 0 }}>
              {slotIdx === 0
                ? <HeroCard article={article} language={language} />
                : <NewsCard
                    article={article}
                    index={pageIdx * CARDS_PER_PAGE + slotIdx}
                    language={language}
                    size="normal"
                    layout={area === 'card4a' || area === 'card4b' || area === 'card5' ? 'horizontal' : 'vertical'}
                  />
              }
            </div>
          );
        })}

        {/* Robot PLACEHOLDER — invisible, holds grid space.
            pointer-events: none lets mouse events fall through to Spline canvas. */}
        <div
          style={{ gridArea: 'robot', minHeight: 0, pointerEvents: 'none' }}
          ref={pageIdx === 0 ? robotSlotRef : null}
        />
      </div>
    ));
  }

  // ── Always render the same wrapper so RobotPanel never unmounts ──────
  return (
    <div className="news-viewport-wrapper" ref={wrapperRef}>

      {/* Arrows — only when content is visible */}
      {!loading && !isEmpty && (
        <button className="viewport-arrow left" onClick={() => scrollBy(-1)} aria-label="Previous page" type="button">
          ‹
        </button>
      )}

      <div className="news-viewport" ref={viewportRef}>
        {loading
          ? renderSkeleton()
          : isEmpty
            ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
                {language === 'ar' ? 'لا توجد مقالات في هذه الفئة' : 'No articles in this category'}
              </div>
            )
            : renderArticles()
        }
      </div>

      {!loading && !isEmpty && (
        <button className="viewport-arrow right" onClick={() => scrollBy(1)} aria-label="Next page" type="button">
          ›
        </button>
      )}

      {!loading && !isEmpty && (
        <div className="scroll-progress" style={{ width: `${progress}%` }} aria-hidden="true" />
      )}

      {/* Robot panel — always mounted once robotPos is available.
          Never removed from DOM so Spline only plays its entrance animation once.
          Hidden (visibility:hidden) on non-All tabs so the slot stays reserved
          but the robot is invisible without unmounting. */}
      {robotPos && (
        <div
          className={`robot-overlay${robotIntro ? ' robot-overlay--intro' : ''}`}
          style={{
            position:   'absolute',
            left:       robotPos.left,
            top:        robotPos.top,
            width:      robotPos.width,
            height:     robotPos.height,
            zIndex:     1,
            visibility: activeTopic === 'all' ? 'visible' : 'hidden',
            pointerEvents: activeTopic === 'all' ? 'auto' : 'none',
          }}
        >
          <RobotPanel />
        </div>
      )}
    </div>
  );
}
