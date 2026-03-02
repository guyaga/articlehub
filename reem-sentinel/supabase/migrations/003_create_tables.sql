-- 003: Create all tables

-- ============================================================
-- 1. profiles — extends auth.users
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  avatar_url  TEXT,
  preferred_lang TEXT NOT NULL DEFAULT 'he' CHECK (preferred_lang IN ('he', 'en')),
  receive_briefs BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. sources — news source registry
-- ============================================================
CREATE TABLE sources (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  url              TEXT NOT NULL,
  rss_url          TEXT,
  source_type      source_type NOT NULL DEFAULT 'mainstream',
  ingestion_method ingestion_method NOT NULL DEFAULT 'rss',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  failure_count    INT NOT NULL DEFAULT 0,
  last_scraped_at  TIMESTAMPTZ,
  config           JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. keywords — tracked topics
-- ============================================================
CREATE TABLE keywords (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_he    TEXT NOT NULL,
  term_en    TEXT,
  category   TEXT,
  weight     REAL NOT NULL DEFAULT 1.0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. scans — scan run metadata
-- ============================================================
CREATE TABLE scans (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status               scan_status NOT NULL DEFAULT 'pending',
  scan_type            TEXT NOT NULL DEFAULT 'scheduled' CHECK (scan_type IN ('scheduled', 'manual')),
  scheduled_at         TIMESTAMPTZ,
  started_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  total_sources        INT NOT NULL DEFAULT 0,
  successful_sources   INT NOT NULL DEFAULT 0,
  failed_sources       INT NOT NULL DEFAULT 0,
  articles_found       INT NOT NULL DEFAULT 0,
  articles_relevant    INT NOT NULL DEFAULT 0,
  error_log            JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. scan_source_results — per-source status within a scan
-- ============================================================
CREATE TABLE scan_source_results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id        UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  source_id      UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  status         scan_status NOT NULL DEFAULT 'pending',
  articles_found INT NOT NULL DEFAULT 0,
  error_message  TEXT,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (scan_id, source_id)
);

-- ============================================================
-- 6. articles — discovered articles (deduplicated by url_hash)
-- ============================================================
CREATE TABLE articles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        UUID REFERENCES sources(id) ON DELETE SET NULL,
  url              TEXT NOT NULL,
  url_hash         TEXT NOT NULL UNIQUE,
  title            TEXT,
  author           TEXT,
  published_at     TIMESTAMPTZ,
  content          TEXT,
  content_length   INT,
  is_drilled_down  BOOLEAN NOT NULL DEFAULT FALSE,
  raw_html         TEXT,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_articles_url_hash ON articles(url_hash);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_source_id ON articles(source_id);

-- ============================================================
-- 7. article_scans — many-to-many: scans ↔ articles
-- ============================================================
CREATE TABLE article_scans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  scan_id    UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (article_id, scan_id)
);

-- ============================================================
-- 8. analyses — AI analysis per article
-- ============================================================
CREATE TABLE analyses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id        UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  relevance_score   REAL,
  relevance_level   relevance_level,
  sentiment         sentiment_type,
  summary_he        TEXT,
  summary_en        TEXT,
  talking_points    JSONB,
  entities          JSONB,
  matched_keywords  JSONB,
  model_used        TEXT,
  prompt_tokens     INT,
  completion_tokens INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analyses_article_id ON analyses(article_id);
CREATE INDEX idx_analyses_relevance ON analyses(relevance_score DESC);

-- ============================================================
-- 9. generated_content — AI-generated content pieces
-- ============================================================
CREATE TABLE generated_content (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id      UUID REFERENCES articles(id) ON DELETE SET NULL,
  analysis_id     UUID REFERENCES analyses(id) ON DELETE SET NULL,
  content_type    content_type NOT NULL,
  title           TEXT,
  body            TEXT NOT NULL,
  body_he         TEXT,
  body_en         TEXT,
  approval_status approval_status NOT NULL DEFAULT 'draft',
  approved_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  revision        INT NOT NULL DEFAULT 1,
  parent_id       UUID REFERENCES generated_content(id) ON DELETE SET NULL,
  model_used      TEXT,
  prompt_tokens   INT,
  completion_tokens INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generated_content_status ON generated_content(approval_status);

-- ============================================================
-- 10. knowledge_base — RAG documents
-- ============================================================
CREATE TABLE knowledge_base (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type    kb_document_type NOT NULL DEFAULT 'other',
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  source_url  TEXT,
  tags        TEXT[] DEFAULT '{}',
  metadata    JSONB DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. knowledge_base_chunks — chunked + embedded for RAG
-- ============================================================
CREATE TABLE knowledge_base_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id       UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content     TEXT NOT NULL,
  token_count INT,
  embedding   VECTOR(1536),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_chunks_kb_id ON knowledge_base_chunks(kb_id);
CREATE INDEX idx_kb_chunks_embedding ON knowledge_base_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- 12. briefs — email intelligence briefs
-- ============================================================
CREATE TABLE briefs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id              UUID REFERENCES scans(id) ON DELETE SET NULL,
  executive_summary_he TEXT,
  executive_summary_en TEXT,
  html_content         TEXT,
  article_count        INT NOT NULL DEFAULT 0,
  delivery_status      delivery_status NOT NULL DEFAULT 'pending',
  sent_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13. brief_recipients — per-recipient delivery tracking
-- ============================================================
CREATE TABLE brief_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id        UUID NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  delivery_status delivery_status NOT NULL DEFAULT 'pending',
  delivered_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (brief_id, profile_id)
);

-- ============================================================
-- 14. brief_articles — which articles in which brief
-- ============================================================
CREATE TABLE brief_articles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id   UUID NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (brief_id, article_id)
);

-- ============================================================
-- 15. entity_registry — tracked people/orgs
-- ============================================================
CREATE TABLE entity_registry (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he      TEXT NOT NULL,
  name_en      TEXT,
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('person', 'organization', 'party', 'government_body', 'other')),
  known_stance TEXT,
  aliases      TEXT[] DEFAULT '{}',
  metadata     JSONB DEFAULT '{}',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 16. article_entities — entities mentioned in articles
-- ============================================================
CREATE TABLE article_entities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id   UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  entity_id    UUID NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
  mention_count INT NOT NULL DEFAULT 1,
  context_snippet TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (article_id, entity_id)
);

-- ============================================================
-- 17. system_config — key-value runtime configuration
-- ============================================================
CREATE TABLE system_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 18. audit_log — system event tracking
-- ============================================================
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  table_name  TEXT,
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
