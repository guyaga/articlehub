/** Shared constants for ArticleHub edge functions. */

/** Fallback threshold; actual value read from system_config at runtime */
export const RELEVANCE_THRESHOLD = parseFloat(
  Deno.env.get("RELEVANCE_THRESHOLD") ?? "0.5",
);

export const MAX_CONCURRENT_SCRAPES = parseInt(
  Deno.env.get("MAX_CONCURRENT_SCRAPES") ?? "10",
  10,
);

export const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1";

export const SCORING_MODEL = "claude-sonnet-4-5-20250929";
export const ANALYSIS_MODEL = "claude-sonnet-4-5-20250929";
export const GENERATION_MODEL = "claude-sonnet-4-20250514";

export const HEADLINE_SCORE_MAX_TOKENS = 64;
export const ANALYSIS_MAX_TOKENS = 1024;
export const GENERATION_MAX_TOKENS = 2048;

export const HASH_BATCH_SIZE = 50;
export const CONTENT_TRUNCATE_LENGTH = 50_000;
export const ANALYSIS_CONTENT_LIMIT = 12_000;
export const GENERATION_CONTENT_LIMIT = 6_000;
