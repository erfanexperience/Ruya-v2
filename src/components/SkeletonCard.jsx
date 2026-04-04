// SkeletonCard.jsx
// Shimmer skeleton placeholder — matches real card layout

import { staggerDelay } from '../utils/helpers.js';

export default function SkeletonCard({ index = 0, isHero = false }) {
  return (
    <div
      className={`card skeleton-card${isHero ? ' hero-card' : ''}`}
      style={{ animationDelay: staggerDelay(index, 80) }}
      aria-hidden="true"
    >
      <div className="skeleton-img">
        <div className="skeleton-line" style={{ height: '100%', width: '100%', borderRadius: 0 }} />
      </div>
      <div className="skeleton-body">
        {/* Meta row */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="skeleton-line short" />
          <div className="skeleton-line" style={{ height: '10px', width: '20%' }} />
        </div>
        {/* Title lines */}
        <div className="skeleton-line tall w-90" />
        <div className="skeleton-line tall w-70" />
        {isHero && <div className="skeleton-line tall w-55" />}
        {/* Summary lines */}
        <div className="skeleton-line medium w-90" />
        <div className="skeleton-line medium w-70" />
        {isHero && <div className="skeleton-line medium w-90" />}
      </div>
      {/* Footer */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '8px 14px',
          borderTop: '1px solid rgba(0,212,255,0.06)',
        }}
      >
        <div className="skeleton-line" style={{ height: '22px', width: '70px', borderRadius: '3px' }} />
        <div className="skeleton-line" style={{ height: '22px', width: '50px', borderRadius: '3px' }} />
      </div>
    </div>
  );
}
