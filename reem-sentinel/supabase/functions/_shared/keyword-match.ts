/** Simple keyword matching — no API calls, instant results. */

import type { Keyword } from "./types.ts";

export interface KeywordMatchResult {
  matched: boolean;
  matchedTerms: string[];
}

/**
 * Check if any active keyword appears in the article title or lead text.
 * Case-insensitive substring matching on both term_he and term_en.
 */
export function matchKeywords(
  title: string,
  lead: string,
  keywords: Keyword[],
): KeywordMatchResult {
  const text = `${title} ${lead}`.toLowerCase();
  const matchedTerms: string[] = [];

  for (const kw of keywords) {
    if (kw.term_he && text.includes(kw.term_he.toLowerCase())) {
      matchedTerms.push(kw.term_he);
      continue;
    }
    if (kw.term_en && text.includes(kw.term_en.toLowerCase())) {
      matchedTerms.push(kw.term_en);
    }
  }

  return { matched: matchedTerms.length > 0, matchedTerms };
}
