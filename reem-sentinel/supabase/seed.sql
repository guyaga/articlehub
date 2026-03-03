-- Seed data for ArticleHub

-- ============================================================
-- News Sources (11 Israeli outlets)
-- ============================================================
INSERT INTO sources (name, url, rss_url, source_type, ingestion_method) VALUES
  ('Ynet',           'https://www.ynet.co.il',        'https://www.ynet.co.il/Integration/StoryRss2.xml',  'mainstream', 'rss'),
  ('N12',            'https://www.mako.co.il/news',   'https://rss.app/feeds/ZqGuWNae74n4XmIb.xml',        'mainstream', 'rss'),
  ('Walla',          'https://news.walla.co.il',      'https://rss.walla.co.il/feed/1',                    'mainstream', 'rss'),
  ('Maariv',         'https://www.maariv.co.il',      'https://www.maariv.co.il/Rss/RssFeedsMivzakim',     'mainstream', 'rss'),
  ('Haaretz',        'https://www.haaretz.co.il',     'https://www.haaretz.co.il/cmlink/1.1617539',        'mainstream', 'rss'),
  ('Israel Hayom',   'https://www.israelhayom.co.il', 'https://www.israelhayom.co.il/rss.xml',             'mainstream', 'rss'),
  ('Globes',         'https://www.globes.co.il',      'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585', 'economic', 'rss'),
  ('Calcalist',      'https://www.calcalist.co.il',   'https://rss.app/feeds/cWIfmUsCU1O0Jc4y.xml',       'economic', 'rss'),
  ('Bizportal',      'https://www.bizportal.co.il',   'https://rss.app/feeds/m7hPyOYGUkB82TAj.xml',       'economic', 'rss'),
  ('Kikar HaShabbat','https://www.kikar.co.il',       'https://www.kikar.co.il/rss',                       'sectoral',  'rss'),
  ('Arutz 7',        'https://www.inn.co.il',         'https://www.inn.co.il/Rss.aspx',                    'sectoral',  'rss'),
  ('KAN 11',         'https://www.kan.org.il',        'https://rss.app/feeds/AfLmJr0jIH4Gj2z1.xml',       'mainstream', 'rss'),
  ('Keyword Feed',   'https://rss.app',               'https://rss.app/feeds/tFqm2D761D46AGnY.xml',       'other',      'rss');

-- ============================================================
-- Core Keywords
-- ============================================================
INSERT INTO keywords (term_he, term_en, category, weight) VALUES
  ('טכנולוגיה', 'Technology', 'topic', 5),
  ('כלכלה', 'Economy', 'topic', 5),
  ('ממשלה', 'Government', 'topic', 5),
  ('בינה מלאכותית', 'Artificial Intelligence', 'topic', 7),
  ('סטארט-אפ', 'Startup', 'topic', 5),
  ('אנרגיה', 'Energy', 'topic', 4),
  ('חינוך', 'Education', 'topic', 4),
  ('בריאות', 'Health', 'topic', 4),
  ('סייבר', 'Cybersecurity', 'topic', 6),
  ('אקלים', 'Climate', 'topic', 4);

-- ============================================================
-- System Config Defaults
-- ============================================================
INSERT INTO system_config (key, value, description) VALUES
  ('scan_schedule', '["08:00", "14:30"]'::jsonb, 'Daily scan times (Israel time)'),
  ('relevance_threshold', '0.5'::jsonb, 'Minimum relevance score for full analysis'),
  ('brief_enabled', 'true'::jsonb, 'Whether to send email briefs after scans'),
  ('max_articles_per_brief', '15'::jsonb, 'Maximum articles to include in a brief'),
  ('drill_down_enabled', 'true'::jsonb, 'Whether to fetch full article content for relevant articles'),
  ('claude_model', '"claude-sonnet-4-5-20250929"'::jsonb, 'Claude model for analysis'),
  ('embedding_model', '"text-embedding-3-small"'::jsonb, 'OpenAI embedding model for RAG');
