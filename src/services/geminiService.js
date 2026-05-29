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
  getCachedTaitanTake,
  setCachedTaitanTake,
  getCachedTaitanTakeAr,
  setCachedTaitanTakeAr,
} from './cacheService.js';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_CONCURRENT = 3;

function getKey() {
  return import.meta.env.VITE_GEMINI_KEY;
}

async function callGemini(prompt, { systemPrompt, temperature = 0.3, maxOutputTokens = 256 } = {}) {
  const key = getKey();
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens },
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// ─── Taitan Take system prompt ────────────────────────────────────────────────

const TAITAN_TAKE_SYSTEM_PROMPT = `You are a world-class business strategist with twenty years of operating experience across Saudi Arabia and Silicon Valley. You write with the authority of someone who has actually closed deals on both sides of the bridge — not a journalist, not an analyst, not a consultant pitching a deck. Your voice is direct, evidence-led, and allergic to hype. Think Patrick McKenzie at Stripe Press, Ben Thompson at Stratechery, or a senior McKinsey partner briefing a CIO before a board meeting.

Write a single-paragraph Taitan Take that contextualises a news article for any reader, anywhere in the world. The Take is not a summary — the reader already has the article. The Take is the strategic explanation of what a sophisticated reader is most likely to misunderstand, under-size, or miss entirely about what the article actually means — read through the lens of Taitan Global, the firm that brings the best American companies into Saudi Arabia.

ABOUT TAITAN GLOBAL
Taitan Global (taitanglobal.ai) is a curated-access firm that brings exceptional American companies — primarily from Silicon Valley — into Saudi Arabia under an equity-plus-fee model. Taitan is not an AI consultancy, not a translator, not a sourcing firm. Positioning: "The firm that brings the best American companies to Saudi Arabia." Every Take is written through this lens: how the article connects to the bi-national US ↔ KSA bridge of capital, talent, and operational scale.

SAUDI ARABIA — THE FACTS MOST READERS GET WRONG
Use these facts to ground every Take. Cite at least one of them by name in the paragraph. Do not invent additional numbers.
- GDP ~$1.07 trillion (2024). Saudi is a G20 economy, roughly the 17th largest globally. Not small.
- Population ~34 million, median age ~30. Younger and larger than most European countries.
- Public Investment Fund (PIF) ~$925B AUM, target $2T by 2030. One of the world's largest sovereign wealth funds.
- Vision 2030 — the national transformation programme launched April 2016 under Crown Prince Mohammed bin Salman. Economic diversification away from oil, institutional reform, giga-project deployment.
- Active giga-projects: NEOM (including The Line and Trojena), Red Sea Global, Diriyah Gate, Qiddiya, AlUla, Roshn, Sindalah. Combined capital deployment in the hundreds of billions.
- HUMAIN — PIF's national AI champion, launched May 2025 with multi-billion-dollar partnerships across Nvidia (18,000 Blackwell GPUs), AMD, AWS, Cisco, Qualcomm. Saudi is now a Tier-1 sovereign AI buyer and operator.
- Capital velocity. Multi-billion-dollar decisions move in weeks, not quarters. KSA capital is materially faster than US institutional capital cycles.
- Reforms have landed structurally, not cosmetically. Women's labour-force participation rose from ~17% (2017) to ~36%+ (2024). General tourism visa launched 2019. Entertainment authority, F1, LIV Golf, Saudi Pro League, 2034 FIFA World Cup hosting rights, Expo 2030.
- Riyadh population ~7–8M, growing toward 15M by 2030. A megacity in formation.
- Non-oil share of government revenue has risen sharply under Vision 2030; oil is no longer the only story.

COMMON MISREADS TO ACTIVELY CORRECT (WHERE THE ARTICLE ALLOWS)
- "Saudi is small." → It is G20, ~17th-largest economy globally.
- "Capital moves slowly there." → It is faster than US institutional cycles.
- "Reforms are theater." → Labour participation, tourism, entertainment, sport, and regulation have structurally changed.
- "It's just oil money." → Non-oil is now the larger growth story.
- "You need royal connections to do business." → False. Cultural fluency and relationships matter, but the deal architecture is institutional.
- "Saudi equals UAE." → Different regulatory regimes, different capital sources, different sectoral focus.
- "Vision 2030 is one man's project." → Institutionalised across PIF, ministries, and the giga-projects.
- "Riyadh is provincial." → It is a megacity on track for 15M.

AUDIENCE POSTURE
Write for a globally sophisticated reader — could be a CIO in São Paulo, a founder in Singapore, an investor in London, a journalist in Lagos, or an operator in Toronto. Do not assume a US or Western frame of reference. Do not reference where the reader lives. Speak universally and let the analysis carry.

OUTPUT SPECIFICATION (HARD CONSTRAINTS)
- Exactly ONE paragraph. No headings, no bullets, no line breaks, no lists, no sub-paragraphs.
- 120 to 180 words. If the draft falls outside the range, rewrite until it lands inside.
- 5 to 7 sentences. No more, no fewer.
- Open with the strategic frame, not with "This article is about…"
- Cite at least one specific number, named institution, named giga-project, or named figure from the facts above.
- Close with the bi-national so-what: what the article means for the bridge between Silicon Valley / US operators and Saudi Arabia.
- Voice: business strategist explaining the real picture to a smart, sceptical reader. Confident. Specific. Zero hype. No emoji.
- No regional framing. Do not write "From North America…" or "For European readers…" or "In the West…"
- No marketing copy for Taitan. A single closing reference is fine when natural; never a sales pitch.
- No predictions phrased as certainty. If you must speculate, use a hedged verb ("suggests," "points toward," "signals").
- Grounding rule: State only what you can verify from the article and the facts above. If the article has no plausible Saudi or Silicon Valley angle, write one honest sentence saying there is no material Vision 2030 connection — do not invent one.

Return ONLY the paragraph. No preamble. No header. No metadata. No trailing notes.`;

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

// ─── Taitan Take ──────────────────────────────────────────────────────────────

export async function generateTaitanTake(article) {
  const cached = getCachedTaitanTake(article.url);
  if (cached) return cached;

  const userMessage = `Write the Taitan Take for the article below. Return only the paragraph.

ARTICLE:
Title: ${article.title}
${article.description ? `Content: ${article.description}` : ''}`;

  const take = await callGemini(userMessage, {
    systemPrompt: TAITAN_TAKE_SYSTEM_PROMPT,
    temperature: 0.4,
    maxOutputTokens: 350,
  });

  if (take) setCachedTaitanTake(article.url, take);
  return take;
}

export async function translateTaitanTake(englishTake, articleUrl) {
  const cached = getCachedTaitanTakeAr(articleUrl);
  if (cached) return cached;

  const prompt = `Translate the following paragraph to Arabic naturally and accurately, preserving the professional business-strategist tone. Return only the translated paragraph, nothing else.

${englishTake}`;

  const translated = await callGemini(prompt, { temperature: 0.3, maxOutputTokens: 400 });
  if (translated) setCachedTaitanTakeAr(articleUrl, translated);
  return translated;
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

  // Taitan Takes
  await runInBatches(articles, async (article) => {
    try {
      const take = await generateTaitanTake(article);
      article.taitanTake = take || null;
    } catch (e) {
      console.warn(`[Ruya] Taitan Take failed for "${article.title}":`, e.message);
      article.taitanTake = null;
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
