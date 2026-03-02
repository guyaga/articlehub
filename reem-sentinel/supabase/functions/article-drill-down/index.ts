/**
 * article-drill-down: Deep scrape + re-analyze a single article.
 * Manual trigger only — fetches full content via Firecrawl,
 * updates article content, sets is_drilled_down = true,
 * then re-runs full AI analysis with the complete text.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getSupabase } from "../_shared/supabase-client.ts";
import { scrapeWithFirecrawl } from "../_shared/firecrawl.ts";
import { analyzeArticle } from "../_shared/analysis.ts";
import { ANALYSIS_MODEL } from "../_shared/constants.ts";
import type { Keyword, ScrapedArticle } from "../_shared/types.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { article_id } = (await req.json()) as { article_id: string };

    if (!article_id) {
      return errorResponse("Missing article_id", 400);
    }

    const db = getSupabase();

    // 1. Fetch article from DB
    const { data: article, error: articleErr } = await db
      .from("articles")
      .select("id, url, title, source_id, is_drilled_down")
      .eq("id", article_id)
      .single();

    if (articleErr || !article) {
      return errorResponse("Article not found", 404);
    }

    if (article.is_drilled_down) {
      return errorResponse("Article already deep-scraped", 400);
    }

    // 2. Scrape full content via Firecrawl
    console.log(`Deep scraping: ${article.url}`);
    const scraped = await scrapeWithFirecrawl(article.url, article.source_id);
    const fullContent = scraped[0]?.content ?? "";

    if (!fullContent) {
      return errorResponse("Firecrawl returned empty content", 502);
    }

    // 3. Update article with full content
    const { error: updateErr } = await db
      .from("articles")
      .update({
        content: fullContent.slice(0, 50_000),
        content_length: fullContent.length,
        is_drilled_down: true,
      })
      .eq("id", article_id);

    if (updateErr) {
      console.error("Failed to update article:", updateErr);
      return errorResponse("Failed to update article content", 500);
    }

    // 4. Fetch keywords for re-analysis
    const { data: keywords } = await db
      .from("keywords")
      .select("*")
      .eq("is_active", true);
    const kw: Keyword[] = keywords ?? [];

    // 5. Re-run full analysis with complete content
    const scrapedArticle: ScrapedArticle = {
      url: article.url,
      title: article.title ?? "",
      author: scraped[0]?.author ?? null,
      published_at: scraped[0]?.published_at ?? null,
      content: fullContent,
      source_id: article.source_id,
    };

    const analysis = await analyzeArticle(scrapedArticle, kw);

    // 6. Upsert analysis — delete old then insert new
    await db.from("analyses").delete().eq("article_id", article_id);

    const { error: analysisErr } = await db.from("analyses").insert({
      article_id,
      relevance_score: analysis.relevance_score,
      sentiment: analysis.sentiment,
      summary_he: analysis.summary_he,
      summary_en: analysis.summary_en,
      entities: JSON.stringify(analysis.entities),
      matched_keywords: JSON.stringify(analysis.matched_keywords),
      model_used: ANALYSIS_MODEL,
    });

    if (analysisErr) {
      console.error("Failed to save analysis:", analysisErr);
      // Content was still saved, so return partial success
    }

    console.log(`Deep scrape complete for article ${article_id}: ${fullContent.length} chars`);

    return jsonResponse({
      success: true,
      article_id,
      content_length: fullContent.length,
      analysis: {
        relevance_score: analysis.relevance_score,
        sentiment: analysis.sentiment,
      },
    });
  } catch (err) {
    console.error("article-drill-down error:", err);
    return errorResponse(String(err));
  }
});
