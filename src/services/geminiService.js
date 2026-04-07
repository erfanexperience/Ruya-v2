// geminiService.js
// All Gemini AI calls — summaries, translations, smart tagging
// Queue: max 3 concurrent, batch processing

import {
  getCachedSummary,
  setCachedSummary,
  getCachedTag,
  setCachedTag,
  getCachedTranslation,
  setCachedTranslation,
} from './cacheService.js';

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_CONCURRENT = 3;

function getKey() {
  return import.meta.env.VITE_GEMINI_KEY;
}

async function callGemini(prompt) {
  const key = getKey();
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 256,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// ─── Batch queue runner (max 3 concurrent) ────────────────────────────────────

async function runInBatches(items, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += MAX_CONCURRENT) {
    const batch = items.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export async function generateSummary(article, language = 'English') {
  const cached = getCachedSummary(article.url);
  if (cached) return cached;

  const prompt = `Summarize this news article in exactly 2 sentences in ${language}.
Keep it factual and concise.
Title: ${article.title}
Content: ${article.description}`;

  const summary = await callGemini(prompt);
  if (summary) setCachedSummary(article.url, summary);
  return summary;
}

// ─── Translation ──────────────────────────────────────────────────────────────

export async function translateArticle(article, targetLanguage) {
  const cached = getCachedTranslation(article.url, targetLanguage);
  if (cached) return cached;

  const prompt = `Translate the following to ${targetLanguage} naturally and accurately.
Return JSON only: { "title": "...", "summary": "..." }
Title: ${article.title}
Summary: ${article.summary || article.description}`;

  const raw = await callGemini(prompt);
  let parsed = null;
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.warn('[Ruya] Translation JSON parse failed, using raw:', raw);
    parsed = { title: article.title, summary: raw };
  }

  if (parsed) setCachedTranslation(article.url, targetLanguage, parsed);
  return parsed;
}

// ─── Smart Tagging ────────────────────────────────────────────────────────────

const VALID_TAGS = [
  'Vision 2030',
  'AI & Robotics',
  'NEOM & Giga Projects',
  'Startups',
  'Cybersecurity',
  'Telecom & 5G',
  'Gaming & Entertainment',
  'General',
];

export async function tagArticle(article) {
  const cached = getCachedTag(article.url);
  if (cached) return cached;

  const prompt = `Classify this article into exactly ONE category from this list:
Vision 2030, AI & Robotics, NEOM & Giga Projects, Startups,
Cybersecurity, Telecom & 5G, Gaming & Entertainment, General
Article title: ${article.title}
Reply with only the category name. Nothing else.`;

  const raw = await callGemini(prompt);
  const tag = VALID_TAGS.find(t => raw.includes(t)) || 'General';
  setCachedTag(article.url, tag);
  return tag;
}

// ─── Batch process all articles (summaries + tags) ────────────────────────────

export async function processArticlesBatch(articles) {
  console.log(`[Ruya] Starting Gemini batch processing for ${articles.length} articles (max ${MAX_CONCURRENT} concurrent)`);

  // Summaries
  await runInBatches(articles, async (article) => {
    try {
      const summary = await generateSummary(article, 'English');
      article.summary = summary || article.description;
    } catch (e) {
      console.warn(`[Ruya] Summary failed for "${article.title}":`, e.message);
      article.summary = article.description;
    }
  });

  // Tags (only for articles not pre-tagged at fetch time)
  await runInBatches(articles, async (article) => {
    if (article.tag) return; // already pre-tagged
    try {
      const tag = await tagArticle(article);
      article.tag = tag;
    } catch (e) {
      console.warn(`[Ruya] Tag failed for "${article.title}":`, e.message);
      article.tag = 'General';
    }
  });

  console.log('[Ruya] Gemini batch processing complete');
  return articles;
}

// ─── Batch pre-translate all articles to Arabic (background job) ──────────────

export async function batchTranslateToArabic(articles) {
  const needsTranslation = articles.filter(a => {
    // Skip if already cached
    return !getCachedTranslation(a.url, 'Arabic');
  });

  if (needsTranslation.length === 0) {
    console.log('[Ruya] Arabic translations: all cached, skipping batch.');
    return;
  }

  console.log(`[Ruya] Pre-translating ${needsTranslation.length} articles to Arabic...`);

  await runInBatches(needsTranslation, async (article) => {
    try {
      await translateArticle(article, 'Arabic');
    } catch (e) {
      // Silent fail — on-demand translation will retry when user clicks
      console.warn(`[Ruya] Arabic pre-translation failed for "${article.title}":`, e.message);
    }
  });

  console.log('[Ruya] Arabic pre-translation complete.');
}
