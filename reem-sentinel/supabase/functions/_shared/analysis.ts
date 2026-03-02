/** Headline scoring and article analysis via Claude. */

import { getAnthropic, stripCodeFences } from "./anthropic-client.ts";
import {
  SCORING_MODEL,
  ANALYSIS_MODEL,
  HEADLINE_SCORE_MAX_TOKENS,
  ANALYSIS_MAX_TOKENS,
  ANALYSIS_CONTENT_LIMIT,
} from "./constants.ts";
import type { Keyword, ScrapedArticle, AnalysisResult } from "./types.ts";

/**
 * Quick relevance score for a headline (0.0-1.0).
 * Lightweight Claude call with 64 max_tokens.
 */
export async function scoreHeadline(
  title: string,
  keywords: Keyword[],
  lead = "",
): Promise<number> {
  const results = await scoreHeadlinesBatch([{ title, lead }], keywords);
  return results[0];
}

/**
 * Batch score multiple headlines in a single Claude call.
 * Much faster than scoring one at a time (1 API call for N headlines).
 */
export async function scoreHeadlinesBatch(
  items: Array<{ title: string; lead?: string }>,
  keywords: Keyword[],
): Promise<number[]> {
  if (items.length === 0) return [];

  // Sort by weight descending so Claude sees most important keywords first
  const sorted = [...keywords].sort((a, b) => b.weight - a.weight);
  const kwText = sorted
    .map((k) => {
      const w = k.weight;
      const priority = w >= 8 ? "CRITICAL" : w >= 5 ? "HIGH" : "NORMAL";
      return `${k.term_he} (${k.term_en ?? ""}) [${priority}]`;
    }).join(", ");

  const headlineList = items.map((item, i) => {
    const leadPart = item.lead ? ` | Lead: ${item.lead.slice(0, 150)}` : "";
    return `${i + 1}. ${item.title}${leadPart}`;
  }).join("\n");

  const prompt =
    "You are a media monitoring assistant for an Israeli public figure. " +
    "Rate the relevance of each headline to the monitoring keywords.\n" +
    "Keywords marked CRITICAL should have the strongest influence on the score. " +
    "HIGH keywords are important. NORMAL keywords are supplementary.\n\n" +
    `Keywords: ${kwText}\n\n` +
    `Headlines:\n${headlineList}\n\n` +
    `Return ONLY a JSON array of ${items.length} numbers (floats 0.0-1.0), one per headline, in order.\n` +
    `Example for 3 headlines: [0.1, 0.8, 0.3]\nNo other text.`;

  try {
    const client = getAnthropic();
    const response = await client.messages.create({
      model: SCORING_MODEL,
      max_tokens: Math.max(128, items.length * 8),
      messages: [{ role: "user", content: prompt }],
    });

    const raw = stripCodeFences(
      response.content[0].type === "text" ? response.content[0].text : "",
    );
    const scores: number[] = JSON.parse(raw);
    return scores.map((s) => Math.max(0.0, Math.min(1.0, parseFloat(String(s)) || 0)));
  } catch (err) {
    console.error(`Batch headline scoring failed:`, err);
    return items.map(() => 0.0);
  }
}

/**
 * Full article analysis via Claude.
 * Returns structured analysis with sentiment, summaries, entities, keywords.
 */
export async function analyzeArticle(
  article: ScrapedArticle,
  keywords: Keyword[],
): Promise<AnalysisResult> {
  const title = article.title ?? "";
  let content = article.content ?? "";

  if (content.length > ANALYSIS_CONTENT_LIMIT) {
    content = content.slice(0, ANALYSIS_CONTENT_LIMIT) + "\n\n[Content truncated]";
  }

  const sorted = [...keywords].sort((a, b) => b.weight - a.weight);
  const kwText = sorted
    .map((k) => {
      const w = k.weight;
      const priority = w >= 8 ? "CRITICAL" : w >= 5 ? "HIGH" : "NORMAL";
      return `${k.term_he} (${k.term_en ?? ""}) [${priority}]`;
    })
    .join(", ");

  const prompt =
    "You are a media analysis assistant for an Israeli public figure. " +
    "Analyze this article and return a structured JSON response.\n" +
    "Give more weight to keywords marked CRITICAL, then HIGH, then NORMAL.\n\n" +
    `Monitoring keywords: ${kwText}\n\n` +
    `Title: ${title}\n\nContent:\n${content}\n\n` +
    "Return ONLY a JSON object with these exact fields:\n" +
    "{\n" +
    '  "relevance_score": <float 0.0-1.0>,\n' +
    '  "sentiment": "<supportive|opposing|neutral|mixed>",\n' +
    '  "summary_he": "<2-3 sentence summary in Hebrew>",\n' +
    '  "summary_en": "<2-3 sentence summary in English>",\n' +
    '  "entities": [{"type": "person|organization|party|government_body|other", "name": "<name>"}],\n' +
    '  "matched_keywords": ["<keyword1>", "..."]\n' +
    "}\n" +
    "No other text outside the JSON.";

  const empty: AnalysisResult = {
    relevance_score: 0.0,
    sentiment: "neutral",
    summary_he: "",
    summary_en: "",
    entities: [],
    matched_keywords: [],
  };

  try {
    const client = getAnthropic();
    const response = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: ANALYSIS_MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = stripCodeFences(
      response.content[0].type === "text" ? response.content[0].text : "",
    );
    const result = JSON.parse(raw);

    return {
      relevance_score: Math.max(
        0.0,
        Math.min(1.0, parseFloat(result.relevance_score ?? 0)),
      ),
      sentiment: result.sentiment ?? "neutral",
      summary_he: result.summary_he ?? "",
      summary_en: result.summary_en ?? "",
      entities: result.entities ?? [],
      matched_keywords: result.matched_keywords ?? [],
    };
  } catch (err) {
    console.error(`Analysis failed for '${title.slice(0, 60)}':`, err);
    return empty;
  }
}
