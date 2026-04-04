// Header.jsx
// Fixed header — ~70px
// Left:   Logo + "Ru'ya | رؤية" brand
// Center: Pulsing LIVE badge + article count + last updated
// Right:  Language toggle [AR | EN] + Saudi time clock (AST UTC+3)
// Bottom: Animated cyan scanning line (pure CSS via ::after)

import { useState, useEffect } from 'react';
import { getSaudiTime, getSaudiDate, lastUpdatedText } from '../utils/helpers.js';

export default function Header({
  language,
  onToggleLanguage,
  articleCount,
  lastFetchTime,
}) {
  const [time, setTime] = useState(getSaudiTime());
  const [date, setDate] = useState(getSaudiDate());

  // Update clock every second
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
      {/* LEFT — Logo + brand + by TAITAN */}
      <div className="header-left">
        <img
          src={`${import.meta.env.BASE_URL}Assets/Logo-land.webp`}
          alt="Ru'ya logo"
          className="header-logo"
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div className="header-brand-group">
          <span className="header-brand">
            {isArabic ? "رؤية | Ru'ya" : "Ru'ya | رؤية"}
          </span>
          <span className="header-by-taitan">by <strong>TAITAN</strong></span>
        </div>
      </div>

      {/* CENTER — Live indicator */}
      <div className="header-center">
        <div className="header-live-row">
          <div className="live-badge">
            <div className="live-dot" />
            <span className="live-text">LIVE FEED</span>
          </div>
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
