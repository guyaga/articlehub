-- 004: Create database functions and triggers

-- ============================================================
-- update_updated_at() — auto-update timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables with updated_at column
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at'
      AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ============================================================
-- handle_new_user() — auto-create profile on auth signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'viewer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- set_relevance_level() — auto-compute from relevance_score
-- ============================================================
CREATE OR REPLACE FUNCTION set_relevance_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.relevance_score IS NULL THEN
    NEW.relevance_level = 'none';
  ELSIF NEW.relevance_score < 0.3 THEN
    NEW.relevance_level = 'low';
  ELSIF NEW.relevance_score < 0.7 THEN
    NEW.relevance_level = 'medium';
  ELSE
    NEW.relevance_level = 'high';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_analyses_set_relevance
  BEFORE INSERT OR UPDATE OF relevance_score ON analyses
  FOR EACH ROW EXECUTE FUNCTION set_relevance_level();

-- ============================================================
-- match_kb_chunks() — RAG similarity search
-- ============================================================
CREATE OR REPLACE FUNCTION match_kb_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  kb_id UUID,
  content TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kbc.id,
    kbc.kb_id,
    kbc.content,
    1 - (kbc.embedding <=> query_embedding) AS similarity
  FROM knowledge_base_chunks kbc
  JOIN knowledge_base kb ON kb.id = kbc.kb_id
  WHERE kb.is_active = TRUE
    AND 1 - (kbc.embedding <=> query_embedding) > match_threshold
  ORDER BY kbc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- upsert_article() — dedup-aware article insertion
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_article(
  p_url TEXT,
  p_url_hash TEXT,
  p_title TEXT,
  p_author TEXT,
  p_published_at TIMESTAMPTZ,
  p_content TEXT,
  p_source_id UUID,
  p_scan_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_article_id UUID;
BEGIN
  -- Try to insert, on conflict just get existing id
  INSERT INTO articles (url, url_hash, title, author, published_at, content, source_id, content_length)
  VALUES (p_url, p_url_hash, p_title, p_author, p_published_at, p_content, p_source_id, LENGTH(p_content))
  ON CONFLICT (url_hash) DO UPDATE
    SET updated_at = NOW()
  RETURNING id INTO v_article_id;

  -- Link article to scan
  INSERT INTO article_scans (article_id, scan_id)
  VALUES (v_article_id, p_scan_id)
  ON CONFLICT (article_id, scan_id) DO NOTHING;

  RETURN v_article_id;
END;
$$ LANGUAGE plpgsql;
