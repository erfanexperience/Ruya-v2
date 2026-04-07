// cacheService.js
// localStorage caching + multi-layer deduplication

const CACHE_KEYS = {
  ARTICLES: 'ruya_articles',
  SUMMARIES: 'ruya_summaries',
  TRANSLATIONS: 'ruya_translations',
  TAGS: 'ruya_tags',
  LAST_FETCH: 'ruya_last_fetch',
  LAST_AI_RUN: 'ruya_last_ai_run',
  LAST_TRANSLATION_RUN: 'ruya_last_translation_run',
};

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Source priority for dedup tiebreaking (index = priority, lower = higher priority) ───
const SOURCE_PRIORITY = [
  'Arab News',
  'TechCrunch',
  'MIT Tech Review',
  'The Verge',
  'NewsAPI',
  'GNews',
  'TheNewsAPI',
  'World News API',
];

function getSourcePriority(sourceName) {
  if (!sourceName) return SOURCE_PRIORITY.length;
  const idx = SOURCE_PRIORITY.findIndex(s =>
    sourceName.toLowerCase().includes(s.toLowerCase())
  );
  return idx === -1 ? SOURCE_PRIORITY.length : idx;
}

// ─── Cache read/write ─────────────────────────────────────────────────────────

export function getCached(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCached(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[Ruya] localStorage write failed:', e);
  }
}

export function isCacheValid() {
  const lastFetch = getCached(CACHE_KEYS.LAST_FETCH);
  if (!lastFetch) return false;
  return Date.now() - lastFetch < TTL_MS;
}

export function isAICacheValid() {
  const lastAI = getCached(CACHE_KEYS.LAST_AI_RUN);
  if (!lastAI) return false;
  return Date.now() - lastAI < TTL_MS;
}

export function markFetched() {
  setCached(CACHE_KEYS.LAST_FETCH, Date.now());
}

export function markAIRun() {
  setCached(CACHE_KEYS.LAST_AI_RUN, Date.now());
}

export function isTranslationCacheValid() {
  const last = getCached(CACHE_KEYS.LAST_TRANSLATION_RUN);
  if (!last) return false;
  return Date.now() - last < TTL_MS;
}

export function markTranslationRun() {
  setCached(CACHE_KEYS.LAST_TRANSLATION_RUN, Date.now());
}

export function clearAllCache() {
  Object.values(CACHE_KEYS).forEach(k => localStorage.removeItem(k));
  console.log('[Ruya] All cache cleared — full re-fetch will occur.');
}

export function getLastFetchTime() {
  return getCached(CACHE_KEYS.LAST_FETCH);
}

// ─── Article cache ────────────────────────────────────────────────────────────

export function getCachedArticles() {
  return getCached(CACHE_KEYS.ARTICLES);
}

export function setCachedArticles(articles) {
  setCached(CACHE_KEYS.ARTICLES, articles);
}

// ─── Summaries cache ──────────────────────────────────────────────────────────

export function getCachedSummaries() {
  return getCached(CACHE_KEYS.SUMMARIES) || {};
}

export function setCachedSummaries(summaries) {
  setCached(CACHE_KEYS.SUMMARIES, summaries);
}

export function getCachedSummary(url) {
  const map = getCachedSummaries();
  return map[url] || null;
}

export function setCachedSummary(url, summary) {
  const map = getCachedSummaries();
  map[url] = summary;
  setCachedSummaries(map);
}

// ─── Tags cache ───────────────────────────────────────────────────────────────

export function getCachedTags() {
  return getCached(CACHE_KEYS.TAGS) || {};
}

export function setCachedTags(tags) {
  setCached(CACHE_KEYS.TAGS, tags);
}

export function getCachedTag(url) {
  const map = getCachedTags();
  return map[url] || null;
}

export function setCachedTag(url, tag) {
  const map = getCachedTags();
  map[url] = tag;
  setCachedTags(map);
}

// ─── Translations cache ───────────────────────────────────────────────────────

export function getCachedTranslations() {
  return getCached(CACHE_KEYS.TRANSLATIONS) || {};
}

export function setCachedTranslations(translations) {
  setCached(CACHE_KEYS.TRANSLATIONS, translations);
}

export function getCachedTranslation(url, language) {
  const map = getCachedTranslations();
  return map[`${url}__${language}`] || null;
}

export function setCachedTranslation(url, language, data) {
  const map = getCachedTranslations();
  map[`${url}__${language}`] = data;
  setCachedTranslations(map);
}

// ─── Deduplication ───────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'in', 'of', 'for', 'to', 'and', 'or', 'is', 'are',
  'was', 'were', 'it', 'its', 'on', 'at', 'by', 'with', 'from', 'that',
  'this', 'as', 'be', 'has', 'have', 'had', 'not', 'but', 'if', 'into',
  // Arabic stop words
  'على', 'في', 'من', 'إلى', 'و', 'ال', 'هذا', 'هذه', 'هو', 'هي',
  'عن', 'مع', 'أو', 'لا', 'ما', 'كان', 'بعد', 'قبل', 'التي', 'الذي',
]);

const SOURCE_NAMES = [
  'arab news', 'saudi gazette', 'al arabiya', 'spa', 'saudi press agency',
  'reuters', 'associated press', 'bbc', 'cnn', 'bloomberg',
];

function normalizeTitle(title) {
  if (!title) return '';
  let t = title.toLowerCase();
  // Remove punctuation & special chars
  t = t.replace(/[^\w\s\u0600-\u06FF]/g, ' ');
  // Remove source names
  SOURCE_NAMES.forEach(s => { t = t.replace(s, ' '); });
  // Tokenize and remove stop words
  const words = t
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return words.sort().join(' ');
}

function wordOverlapScore(titleA, titleB) {
  const wordsA = new Set(titleA.split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(titleB.split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) overlap++; });
  return overlap / Math.min(wordsA.size, wordsB.size);
}

export function deduplicateArticles(articles) {
  const before = articles.length;
  const seenUrls = new Map();       // url → index in result
  const seenFingerprints = new Map(); // fingerprint → index in result
  const result = [];

  for (const article of articles) {
    const url = (article.url || '').trim();
    const fingerprint = normalizeTitle(article.title);

    // Layer 1 — exact URL
    if (url && seenUrls.has(url)) {
      const existingIdx = seenUrls.get(url);
      const existing = result[existingIdx];
      if (getSourcePriority(article.source) < getSourcePriority(existing.source)) {
        result[existingIdx] = article;
      }
      continue;
    }

    // Layer 2 — title fingerprint
    if (fingerprint && seenFingerprints.has(fingerprint)) {
      const existingIdx = seenFingerprints.get(fingerprint);
      const existing = result[existingIdx];
      if (getSourcePriority(article.source) < getSourcePriority(existing.source)) {
        result[existingIdx] = article;
        if (url) seenUrls.set(url, existingIdx);
      }
      continue;
    }

    // Layer 3 — fuzzy word overlap (only against the last 100 to keep perf reasonable)
    const checkRange = result.slice(-100);
    let isDuplicate = false;
    for (let i = 0; i < checkRange.length; i++) {
      const existingFp = normalizeTitle(checkRange[i].title);
      if (wordOverlapScore(fingerprint, existingFp) > 0.7) {
        const globalIdx = result.length - checkRange.length + i;
        if (getSourcePriority(article.source) < getSourcePriority(result[globalIdx].source)) {
          result[globalIdx] = article;
          if (url) seenUrls.set(url, globalIdx);
          if (fingerprint) seenFingerprints.set(fingerprint, globalIdx);
        }
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      const idx = result.length;
      result.push(article);
      if (url) seenUrls.set(url, idx);
      if (fingerprint) seenFingerprints.set(fingerprint, idx);
    }
  }

  const removed = before - result.length;
  console.log(`[Ruya] Deduplication: ${before} → ${result.length} articles (${removed} duplicates removed)`);
  return result;
}
