// Database types for Reem-AI Sentinel

export type ScanStatus = "pending" | "running" | "partial" | "completed" | "failed";
export type RelevanceLevel = "none" | "low" | "medium" | "high";
export type SentimentType = "supportive" | "opposing" | "neutral" | "mixed";
export type ContentType =
  | "social_post_facebook"
  | "social_post_twitter"
  | "social_post_linkedin"
  | "visual_concept"
  | "op_ed"
  | "press_response"
  | "video_script_short"
  | "blog_post"
  | "custom";
export type ApprovalStatus = "draft" | "pending_review" | "approved" | "rejected" | "published" | "archived";
export type SourceType = "mainstream" | "economic" | "sectoral" | "social_media" | "other";

export interface Source {
  id: string;
  name: string;
  url: string;
  rss_url: string | null;
  source_type: SourceType;
  ingestion_method: "rss" | "firecrawl" | "manual";
  is_active: boolean;
  failure_count: number;
  last_scraped_at: string | null;
  created_at: string;
}

export interface Keyword {
  id: string;
  term_he: string;
  term_en: string | null;
  category: string | null;
  weight: number;
  is_active: boolean;
}

export interface Scan {
  id: string;
  status: ScanStatus;
  scan_type: string;
  started_at: string | null;
  completed_at: string | null;
  total_sources: number;
  successful_sources: number;
  failed_sources: number;
  articles_found: number;
  articles_relevant: number;
  created_at: string;
}

export interface Article {
  id: string;
  source_id: string | null;
  url: string;
  title: string | null;
  author: string | null;
  published_at: string | null;
  content: string | null;
  content_length: number | null;
  is_drilled_down: boolean;
  created_at: string;
  source?: Source;
  analysis?: Analysis;
}

export interface Analysis {
  id: string;
  article_id: string;
  relevance_score: number | null;
  relevance_level: RelevanceLevel | null;
  sentiment: SentimentType | null;
  summary_he: string | null;
  summary_en: string | null;
  entities: string | null;
  matched_keywords: string | null;
  model_used: string | null;
  created_at: string;
}

export interface GeneratedContent {
  id: string;
  article_id: string | null;
  content_type: ContentType;
  title: string | null;
  body: string;
  body_he: string | null;
  body_en: string | null;
  approval_status: ApprovalStatus;
  revision: number;
  created_at: string;
}

export interface KnowledgeBaseDoc {
  id: string;
  doc_type: string;
  title: string;
  content: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
}

export interface SystemConfig {
  key: string;
  value: unknown;
  description: string | null;
}
