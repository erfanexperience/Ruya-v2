// HeroSection.jsx
// Full-viewport hero: 60% left = heading/copy, 40% right = Spline robot
// Only shown once at the top of the page before the news feed

import { Suspense, lazy } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

const SCENE = 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode';

function RobotFallback() {
  return (
    <div className="hero-robot-fallback">
      <div className="robot-fallback-ring" />
      <div className="robot-fallback-ring robot-fallback-ring--2" />
      <span className="robot-fallback-text">INITIALIZING</span>
    </div>
  );
}

export default function HeroSection({ language }) {
  const isArabic = language === 'ar';

  return (
    <section className="hero-section">
      {/* LEFT — heading copy */}
      <div className="hero-copy">
        <div className="hero-eyebrow">
          <span className="hero-eyebrow-dot" />
          {isArabic ? 'منصة الأخبار التقنية السعودية' : 'Saudi Tech Intelligence'}
        </div>

        <h1 className="hero-heading">
          {isArabic ? (
            <>
              <span className="hero-heading-line">المستقبل يُصنع</span>
              <span className="hero-heading-line accent">هنا الآن</span>
            </>
          ) : (
            <>
              <span className="hero-heading-line">The Future Is</span>
              <span className="hero-heading-line accent">Being Built Here</span>
            </>
          )}
        </h1>

        <p className="hero-sub">
          {isArabic
            ? 'تغطية لحظية للذكاء الاصطناعي ورؤية 2030 والتقنية السعودية — مدعومة بالذكاء الاصطناعي'
            : 'Real-time coverage of AI, Vision 2030 & Saudi tech — curated and summarised by AI across 9 live sources'}
        </p>

        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-value">9</span>
            <span className="hero-stat-label">{isArabic ? 'مصادر مباشرة' : 'Live Sources'}</span>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <span className="hero-stat-value">24h</span>
            <span className="hero-stat-label">{isArabic ? 'تحديث كل' : 'Auto Refresh'}</span>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <span className="hero-stat-value">AI</span>
            <span className="hero-stat-label">{isArabic ? 'ملخصات' : 'Summaries'}</span>
          </div>
        </div>

        <div className="hero-scroll-hint">
          <span>{isArabic ? 'اسحب للأسفل' : 'Scroll for news'}</span>
          <div className="hero-scroll-arrow" />
        </div>
      </div>

      {/* RIGHT — 3D robot */}
      <div className="hero-robot">
        <div className="hero-robot-inner">
          <Suspense fallback={<RobotFallback />}>
            <Spline scene={SCENE} className="hero-spline" />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
