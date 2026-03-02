-- 002: Create custom enum types

CREATE TYPE scan_status AS ENUM ('pending', 'running', 'partial', 'completed', 'failed');
CREATE TYPE relevance_level AS ENUM ('none', 'low', 'medium', 'high');
CREATE TYPE sentiment_type AS ENUM ('supportive', 'opposing', 'neutral', 'mixed');
CREATE TYPE content_type AS ENUM (
  'social_post_facebook',
  'social_post_twitter',
  'social_post_linkedin',
  'visual_concept',
  'op_ed',
  'press_response',
  'video_script_short',
  'blog_post',
  'custom'
);
CREATE TYPE approval_status AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'published', 'archived');
CREATE TYPE source_type AS ENUM ('mainstream', 'economic', 'sectoral', 'social_media', 'other');
CREATE TYPE ingestion_method AS ENUM ('rss', 'firecrawl', 'manual');
CREATE TYPE kb_document_type AS ENUM ('transcript', 'article', 'social_post', 'talking_points', 'data_sheet', 'style_guide', 'other');
CREATE TYPE delivery_status AS ENUM ('pending', 'sent', 'failed', 'bounced');
