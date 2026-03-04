/** Shared constants for ArticleHub edge functions. */

export const MAX_CONCURRENT_SCRAPES = parseInt(
  Deno.env.get("MAX_CONCURRENT_SCRAPES") ?? "10",
  10,
);

export const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1";
export const FIRECRAWL_CONCURRENCY = 10;

export const ANALYSIS_MODEL = "claude-sonnet-4-5-20250929";
export const GENERATION_MODEL = "claude-sonnet-4-20250514";

export const ANALYSIS_MAX_TOKENS = 1024;
export const GENERATION_MAX_TOKENS = 2048;

export const HASH_BATCH_SIZE = 50;
export const CONTENT_TRUNCATE_LENGTH = 50_000;
export const ANALYSIS_CONTENT_LIMIT = 12_000;
export const GENERATION_CONTENT_LIMIT = 6_000;

/** Time guard: exit scan-process gracefully before Supabase 60s timeout */
export const PROCESS_TIME_LIMIT_MS = 45_000;
