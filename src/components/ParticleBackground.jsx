// ParticleBackground.jsx
// Canvas-based drifting particles — cyberpunk data stream aesthetic
// Isolated component: never re-renders from parent state

import { useEffect, useRef } from 'react';

const PARTICLE_COUNT = 80;
const PARTICLE_COLORS = [
  'rgba(0, 212, 255, 0.6)',
  'rgba(0, 212, 255, 0.3)',
  'rgba(0, 255, 136, 0.3)',
  'rgba(0, 212, 255, 0.15)',
  'rgba(255, 107, 53, 0.2)',
];

function createParticle(width, height) {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4 - 0.1, // slight upward drift
    radius: Math.random() * 1.5 + 0.3,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    opacity: Math.random() * 0.7 + 0.2,
    flicker: Math.random() * Math.PI * 2,
    flickerSpeed: Math.random() * 0.03 + 0.01,
  };
}

export default function ParticleBackground() {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    particles: [],
    animationId: null,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const state = stateRef.current;

    function resize() {
      state.width = canvas.width = window.innerWidth;
      state.height = canvas.height = window.innerHeight;
    }

    function init() {
      resize();
      state.particles = Array.from(
        { length: PARTICLE_COUNT },
        () => createParticle(state.width, state.height)
      );
    }

    function draw() {
      ctx.clearRect(0, 0, state.width, state.height);

      state.particles.forEach(p => {
        // Drift
        p.x += p.vx;
        p.y += p.vy;
        p.flicker += p.flickerSpeed;

        // Wrap around edges
        if (p.x < -5) p.x = state.width + 5;
        if (p.x > state.width + 5) p.x = -5;
        if (p.y < -5) p.y = state.height + 5;
        if (p.y > state.height + 5) p.y = -5;

        const flickerOpacity = p.opacity * (0.7 + 0.3 * Math.sin(p.flicker));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${flickerOpacity})`);
        ctx.fill();

        // Occasional small connecting lines between nearby particles
        if (p.radius > 1.2) {
          state.particles.forEach(other => {
            if (other === p) return;
            const dx = p.x - other.x;
            const dy = p.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 80) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(other.x, other.y);
              ctx.strokeStyle = `rgba(0, 212, 255, ${0.04 * (1 - dist / 80)})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          });
        }
      });

      state.animationId = requestAnimationFrame(draw);
    }

    init();
    draw();

    const handleResize = () => {
      resize();
    };
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      cancelAnimationFrame(state.animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="particle-canvas"
      aria-hidden="true"
    />
  );
}
