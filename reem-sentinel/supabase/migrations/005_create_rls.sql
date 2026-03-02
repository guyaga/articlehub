-- 005: Row Level Security policies

-- Enable RLS on all public tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_source_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE brief_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE brief_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: check user role
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- profiles
-- ============================================================
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- sources — read: all authenticated; write: admin only
-- ============================================================
CREATE POLICY "Authenticated can read sources"
  ON sources FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Admin can manage sources"
  ON sources FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================================
-- keywords — read: all; write: admin
-- ============================================================
CREATE POLICY "Authenticated can read keywords"
  ON keywords FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Admin can manage keywords"
  ON keywords FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================================
-- scans — read: all
-- ============================================================
CREATE POLICY "Authenticated can read scans"
  ON scans FOR SELECT TO authenticated
  USING (TRUE);

-- ============================================================
-- scan_source_results — read: all
-- ============================================================
CREATE POLICY "Authenticated can read scan results"
  ON scan_source_results FOR SELECT TO authenticated
  USING (TRUE);

-- ============================================================
-- articles — read: all
-- ============================================================
CREATE POLICY "Authenticated can read articles"
  ON articles FOR SELECT TO authenticated
  USING (TRUE);

-- ============================================================
-- article_scans — read: all
-- ============================================================
CREATE POLICY "Authenticated can read article_scans"
  ON article_scans FOR SELECT TO authenticated
  USING (TRUE);

-- ============================================================
-- analyses — read: all
-- ============================================================
CREATE POLICY "Authenticated can read analyses"
  ON analyses FOR SELECT TO authenticated
  USING (TRUE);

-- ============================================================
-- generated_content — read: all; update approval: admin/editor
-- ============================================================
CREATE POLICY "Authenticated can read content"
  ON generated_content FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Admin/editor can manage content"
  ON generated_content FOR ALL TO authenticated
  USING (public.user_role() IN ('admin', 'editor'))
  WITH CHECK (public.user_role() IN ('admin', 'editor'));

-- ============================================================
-- knowledge_base — read: all; write: admin/editor
-- ============================================================
CREATE POLICY "Authenticated can read knowledge_base"
  ON knowledge_base FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Admin/editor can manage knowledge_base"
  ON knowledge_base FOR ALL TO authenticated
  USING (public.user_role() IN ('admin', 'editor'))
  WITH CHECK (public.user_role() IN ('admin', 'editor'));

-- ============================================================
-- knowledge_base_chunks — read: all
-- ============================================================
CREATE POLICY "Authenticated can read kb_chunks"
  ON knowledge_base_chunks FOR SELECT TO authenticated
  USING (TRUE);

-- ============================================================
-- briefs — read: all
-- ============================================================
CREATE POLICY "Authenticated can read briefs"
  ON briefs FOR SELECT TO authenticated
  USING (TRUE);

-- ============================================================
-- brief_recipients — read: own or admin
-- ============================================================
CREATE POLICY "Users can read own brief deliveries"
  ON brief_recipients FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.user_role() = 'admin');

-- ============================================================
-- brief_articles — read: all
-- ============================================================
CREATE POLICY "Authenticated can read brief_articles"
  ON brief_articles FOR SELECT TO authenticated
  USING (TRUE);

-- ============================================================
-- entity_registry — read: all; write: admin
-- ============================================================
CREATE POLICY "Authenticated can read entities"
  ON entity_registry FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Admin can manage entities"
  ON entity_registry FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================================
-- article_entities — read: all
-- ============================================================
CREATE POLICY "Authenticated can read article_entities"
  ON article_entities FOR SELECT TO authenticated
  USING (TRUE);

-- ============================================================
-- system_config — read: all; write: admin
-- ============================================================
CREATE POLICY "Authenticated can read config"
  ON system_config FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "Admin can manage config"
  ON system_config FOR ALL TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================================
-- audit_log — read: admin only
-- ============================================================
CREATE POLICY "Admin can read audit log"
  ON audit_log FOR SELECT TO authenticated
  USING (public.user_role() = 'admin');
