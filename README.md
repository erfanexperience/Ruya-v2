# Ru'ya | رؤية

**Bilingual (Arabic/English) futuristic Saudi tech news platform.**
Cyberpunk command center aesthetic. Powered by 9 live news sources + Gemini AI.

---

## Quick Start

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173)

---

## Environment Setup

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

```env
VITE_NEWSAPI_KEY=        # https://newsapi.org — 100 req/day free
VITE_GNEWS_KEY=          # https://gnews.io — 100 req/day free
VITE_THENEWSAPI_KEY=     # https://thenewsapi.com — 100 req/day free
VITE_WORLDNEWS_KEY=      # https://worldnewsapi.com — 500 req/day free
VITE_GEMINI_KEY=         # https://makersuite.google.com — Gemini 1.5 Flash free tier
```

---

## Free Tier Limits

| API | Free Tier | Notes |
|---|---|---|
| NewsAPI | 100 requests/day | Developer plan, headlines only |
| GNews | 100 requests/day | 10 articles per request |
| TheNewsAPI | 100 requests/day | English + Arabic support |
| World News API | 500 requests/day | Saudi sources |
| Gemini 1.5 Flash | 15 req/min, 1M req/day | Free via Google AI Studio |

**Important:** All data is cached for 24 hours in localStorage. On a normal day the app makes fewer than 10 API calls total (one fresh fetch per 24 hours).

---

## Deploy to Netlify (Free)

```bash
npm run build
```

Then drag the generated `dist/` folder to [netlify.com/drop](https://app.netlify.com/drop).

No server needed — fully static.

---

## Manual Cache Refresh

Press **Ctrl+Shift+R** anywhere in the app to:
1. Clear all localStorage cache (articles, summaries, translations, tags)
2. Force a full re-fetch from all 9 sources
3. Re-run Gemini AI processing

Useful for development or when you want fresh news before the 24-hour TTL expires.

---

## Architecture

```
src/
├── components/
│   ├── Header.jsx              Logo, LIVE badge, lang toggle, Saudi clock
│   ├── TopicNav.jsx            Category tabs (8 topics, bilingual)
│   ├── NewsViewport.jsx        Horizontal scroll-snap container + arrows
│   ├── HeroCard.jsx            Large 40%-width top story card
│   ├── NewsCard.jsx            Standard card with 3D flip translate
│   ├── SkeletonCard.jsx        Shimmer loading placeholder
│   └── ParticleBackground.jsx  Canvas drifting particles
├── services/
│   ├── newsService.js          Fetches from 9 sources simultaneously
│   ├── geminiService.js        Summaries, translation, smart tagging
│   └── cacheService.js         24h localStorage cache + 3-layer deduplication
├── hooks/
│   ├── useNews.js              Orchestrates fetch → dedup → cache → AI
│   └── useLanguage.js          AR/EN toggle + RTL direction
└── utils/
    └── helpers.js              Time, truncation, fallback images
```

---

## Features

- **9 simultaneous sources** — 4 RSS feeds + 4 news APIs, all fetched in parallel with `Promise.allSettled`
- **3-layer deduplication** — URL match → title fingerprint → 70% word-overlap fuzzy match
- **Gemini AI** — Auto-summaries, on-demand translation (AR/EN), smart topic tagging; max 3 concurrent calls
- **24-hour cache** — Zero API calls on repeat visits within the day
- **Horizontal scroll-snap** — Desktop: snap pages, each with 1 hero + 2 cards
- **RTL support** — Full Arabic layout flip on language switch
- **Cyberpunk UI** — Holographic cards, particle canvas, scan-line header animation, magnetic card hover
