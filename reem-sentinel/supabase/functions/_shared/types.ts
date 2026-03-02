/** Shared TypeScript interfaces for Sentinel edge functions. */

export interface Source {
  id: string;
  name: string;
  url: string;
  rss_url: string | null;
  source_type: string;
  ingestion_method: "rss" | "firecrawl" | "manual";
  is_active: boolean;
  failure_count: number;
  last_scraped_at: string | null;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Keyword {
  id: string;
  term_he: string;
  term_en: string | null;
  category: string | null;
  weight: number;
  is_active: boolean;
}

export interface ScrapedArticle {
  url: string;
  title: string;
  author: string | null;
  published_at: string | null;
  content: string;
  source_id: string;
  url_hash?: string;
}

export interface ScoredArticle {
  article: ScrapedArticle;
  headline_score: number;
}

export interface AnalysisResult {
  relevance_score: number;
  sentiment: "supportive" | "opposing" | "neutral" | "mixed";
  summary_he: string;
  summary_en: string;
  entities: Array<{ type: string; name: string }>;
  matched_keywords: string[];
}

export interface GenerationResult {
  content_type: string;
  content_he: string;
  content_en: string;
  metadata: {
    tone?: string;
    target_audience?: string;
    key_messages?: string[];
  };
}

export interface ScrapeResult {
  articles: ScrapedArticle[];
  source_id: string;
  status: "ok" | "error";
  error?: string;
}

export interface ProcessResult {
  articles_found: number;
  articles_relevant: number;
  new_articles: number;
}
