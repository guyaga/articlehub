-- Allow anon (unauthenticated) read access to dashboard tables
-- This is safe for an internal tool; the anon key is only in env vars

CREATE POLICY "Anon can read sources" ON sources FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Anon can read keywords" ON keywords FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Anon can read scans" ON scans FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Anon can read scan_source_results" ON scan_source_results FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Anon can read articles" ON articles FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Anon can read article_scans" ON article_scans FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Anon can read analyses" ON analyses FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Anon can read generated_content" ON generated_content FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Anon can read knowledge_base" ON knowledge_base FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Anon can read knowledge_base_chunks" ON knowledge_base_chunks FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Anon can read briefs" ON briefs FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Anon can read brief_articles" ON brief_articles FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Anon can read entity_registry" ON entity_registry FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Anon can read article_entities" ON article_entities FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Anon can read system_config" ON system_config FOR SELECT TO anon USING (TRUE);
