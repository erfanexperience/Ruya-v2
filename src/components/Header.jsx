// Header.jsx — TAITAN Pulse

import { useState, useEffect } from 'react';
import { getSaudiTime, getSaudiDate } from '../utils/helpers.js';

export default function Header({ language, onToggleLanguage }) {
  const [time, setTime] = useState(getSaudiTime());
  const [date, setDate] = useState(getSaudiDate());

  useEffect(() => {
    const id = setInterval(() => {
      setTime(getSaudiTime());
      setDate(getSaudiDate());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const isArabic = language === 'ar';

  return (
    <header className="header">
      {/* LEFT — Logo + brand */}
      <div className="header-left">
        <img
          src={`${import.meta.env.BASE_URL}Assets/Logo-v2.webp`}
          alt="TAITAN Pulse logo"
          className="header-logo"
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div className="header-brand-group">
          <span className="header-brand">
            <span className="brand-taitan">TAITAN</span>
            <span className="brand-pulse"> Pulse</span>
          </span>
        </div>
      </div>

      {/* CENTER — Live indicator */}
      <div className="header-center">
        <div className="live-badge">
          <div className="live-dot" />
          <span className="live-text">LIVE FEED</span>
        </div>
      </div>

      {/* RIGHT — Language toggle + clock */}
      <div className="header-right">
        <div
          className="lang-toggle"
          onClick={onToggleLanguage}
          role="button"
          tabIndex={0}
          aria-label="Toggle language"
          onKeyDown={e => e.key === 'Enter' && onToggleLanguage()}
        >
          <span className={`lang-option${isArabic ? ' active' : ''}`}>AR</span>
          <span className={`lang-option${!isArabic ? ' active' : ''}`}>EN</span>
        </div>
        <div className="header-clock">
          <span className="clock-time">{time}</span>
          <span className="clock-date">{date} AST</span>
        </div>
      </div>
    </header>
  );
}
