// RobotPanel.jsx
// 3D Spline robot — zoomed to upper body, no border frame

import { Suspense, lazy } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

const SCENE = 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode';

function RobotFallback() {
  return (
    <div className="robot-fallback">
      <div className="robot-fallback-ring" />
      <div className="robot-fallback-ring robot-fallback-ring--2" />
      <span className="robot-fallback-text">INITIALIZING</span>
    </div>
  );
}

export default function RobotPanel() {
  return (
    <div className="robot-panel">
      <div className="robot-zoom-wrap">
        <Suspense fallback={<RobotFallback />}>
          <Spline scene={SCENE} className="robot-spline" />
        </Suspense>
      </div>
    </div>
  );
}
