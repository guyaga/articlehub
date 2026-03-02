-- Seed data for Reem-AI Sentinel

-- ============================================================
-- News Sources (11 Israeli outlets)
-- ============================================================
INSERT INTO sources (name, url, rss_url, source_type, ingestion_method) VALUES
  ('Ynet',           'https://www.ynet.co.il',        'https://www.ynet.co.il/Integration/StoryRss2.xml',  'mainstream', 'rss'),
  ('N12',            'https://www.mako.co.il/news',   NULL,                                                'mainstream', 'firecrawl'),
  ('Walla',          'https://news.walla.co.il',      'https://rss.walla.co.il/feed/1',                    'mainstream', 'rss'),
  ('Maariv',         'https://www.maariv.co.il',      'https://www.maariv.co.il/Rss/RssFeedsMivzakim',     'mainstream', 'rss'),
  ('Haaretz',        'https://www.haaretz.co.il',     'https://www.haaretz.co.il/cmlink/1.1617539',        'mainstream', 'rss'),
  ('Israel Hayom',   'https://www.israelhayom.co.il', 'https://www.israelhayom.co.il/rss.xml',             'mainstream', 'rss'),
  ('Globes',         'https://www.globes.co.il',      'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585', 'economic', 'rss'),
  ('Calcalist',      'https://www.calcalist.co.il',   NULL,                                                'economic', 'firecrawl'),
  ('Bizportal',      'https://www.bizportal.co.il',   NULL,                                                'economic', 'firecrawl'),
  ('Kikar HaShabbat','https://www.kikar.co.il',       'https://www.kikar.co.il/rss',                       'sectoral',  'rss'),
  ('Arutz 7',        'https://www.inn.co.il',         'https://www.inn.co.il/Rss.aspx',                    'sectoral',  'rss');

-- ============================================================
-- Core Keywords
-- ============================================================
INSERT INTO keywords (term_he, term_en, category, weight) VALUES
  ('ראם', 'Reem', 'name', 2.0),
  ('שר הכלכלה', 'Minister of Economy', 'title', 1.8),
  ('משרד הכלכלה', 'Ministry of Economy', 'institution', 1.5),
  ('יוקר המחיה', 'Cost of living', 'policy', 1.2),
  ('תחרות עסקית', 'Business competition', 'policy', 1.0),
  ('רגולציה', 'Regulation', 'policy', 1.0),
  ('יבוא מקביל', 'Parallel import', 'policy', 1.2),
  ('סחר חוץ', 'Foreign trade', 'policy', 1.0),
  ('קואליציה', 'Coalition', 'politics', 0.8),
  ('תקציב המדינה', 'State budget', 'policy', 1.0);

-- ============================================================
-- System Config Defaults
-- ============================================================
INSERT INTO system_config (key, value, description) VALUES
  ('scan_schedule', '["08:00", "14:30"]'::jsonb, 'Daily scan times (Israel time)'),
  ('relevance_threshold', '0.85'::jsonb, 'Minimum relevance score for drill-down'),
  ('brief_enabled', 'true'::jsonb, 'Whether to send email briefs after scans'),
  ('max_articles_per_brief', '15'::jsonb, 'Maximum articles to include in a brief'),
  ('drill_down_enabled', 'true'::jsonb, 'Whether to fetch full article content for relevant articles'),
  ('claude_model', '"claude-sonnet-4-5-20250929"'::jsonb, 'Claude model for analysis'),
  ('embedding_model', '"text-embedding-3-small"'::jsonb, 'OpenAI embedding model for RAG');
