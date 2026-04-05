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
