/**
 * scan-process: Analysis + persistence function.
 * Receives all scraped articles, deduplicates, scores headlines,
 * performs full analysis on relevant articles, persists everything.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getSupabase } from "../_shared/supabase-client.ts";
import { scoreHeadlinesBatch, analyzeArticle } from "../_shared/analysis.ts";
import { md5 } from "../_shared/md5.ts";
import {
  RELEVANCE_THRESHOLD,
  HASH_BATCH_SIZE,
  CONTENT_TRUNCATE_LENGTH,
  ANALYSIS_MODEL,
} from "../_shared/constants.ts";
import type { ScrapedArticle, Keyword, ProcessResult } from "../_shared/types.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { scan_id, articles } = (await req.json()) as {
      scan_id: string;
      articles: ScrapedArticle[];
    };

    if (!scan_id) return errorResponse("Missing scan_id", 400);

    const db = getSupabase();

    // --- Read threshold from system_config, fallback to constant ---
    let threshold = RELEVANCE_THRESHOLD;
    try {
      const { data: configRow } = await db
        .from("system_config")
        .select("value")
        .eq("key", "relevance_threshold")
        .single();
      if (configRow?.value != null) {
        const parsed = typeof configRow.value === "number"
          ? configRow.value
          : parseFloat(String(configRow.value));
        if (!isNaN(parsed)) threshold = parsed;
      }
    } catch {
      // Non-critical: use fallback
    }

    // --- Deduplicate by URL hash ---
    const seen = new Set<string>();
    const uniqueArticles: ScrapedArticle[] = [];

    for (const article of articles) {
      if (!article.url) continue;
      const urlHash = await md5(article.url);
      if (!seen.has(urlHash)) {
        seen.add(urlHash);
        article.url_hash = urlHash;
        uniqueArticles.push(article);
      }
    }

    console.log(`Dedup: ${articles.length} -> ${uniqueArticles.length} unique articles`);

    // --- Fetch active keywords ---
    const { data: keywords } = await db
      .from("keywords")
      .select("*")
      .eq("is_active", true);
    const kw: Keyword[] = keywords ?? [];

    // --- Check existing URL hashes in batches ---
    const existingHashes = new Set<string>();
    const allHashes = uniqueArticles.map((a) => a.url_hash!);

    for (let i = 0; i < allHashes.length; i += HASH_BATCH_SIZE) {
      const batch = allHashes.slice(i, i + HASH_BATCH_SIZE);
      const { data: existing } = await db
        .from("articles")
        .select("url_hash")
        .in("url_hash", batch);
      for (const row of existing ?? []) {
        existingHashes.add(row.url_hash);
      }
    }

    // --- Filter to new articles only ---
    let newArticles = 0;
    let relevantCount = 0;

    const newUniqueArticles = uniqueArticles.filter(
      (a) => !existingHashes.has(a.url_hash!),
    );

    if (newUniqueArticles.length === 0) {
      console.log("No new articles to process");
      return jsonResponse({ articles_found: uniqueArticles.length, articles_relevant: 0, new_articles: 0 });
    }

    // --- Batch score headlines (20 per Claude call) ---
    const SCORE_BATCH = 20;
    const allScores: number[] = [];

    for (let i = 0; i < newUniqueArticles.length; i += SCORE_BATCH) {
      const batch = newUniqueArticles.slice(i, i + SCORE_BATCH);
      const items = batch.map((a) => ({
        title: a.title ?? "",
        lead: (a.content ?? "").slice(0, 200),
      }));
      const scores = await scoreHeadlinesBatch(items, kw);
      allScores.push(...scores);
      console.log(`Scored batch ${Math.floor(i / SCORE_BATCH) + 1}: ${scores.length} headlines`);
    }

    // --- Persist all articles and analyze relevant ones ---
    for (let idx = 0; idx < newUniqueArticles.length; idx++) {
      const article = newUniqueArticles[idx];
      const headlineScore = allScores[idx] ?? 0;

      try {
        const articleId = crypto.randomUUID();
        const content = article.content ?? "";

        // Persist article
        await db.from("articles").insert({
          id: articleId,
          source_id: article.source_id,
          url: article.url,
          url_hash: article.url_hash!,
          title: article.title,
          author: article.author,
          published_at: article.published_at,
          content: content.slice(0, CONTENT_TRUNCATE_LENGTH) || null,
          content_length: content.length,
        });

        // Link article to scan
        await db.from("article_scans").insert({
          article_id: articleId,
          scan_id,
        });

        newArticles++;

        // Full analysis for articles above threshold
        if (headlineScore >= threshold) {
          try {
            const analysis = await analyzeArticle(article, kw);
            await db.from("analyses").insert({
              article_id: articleId,
              relevance_score: analysis.relevance_score,
              sentiment: analysis.sentiment,
              summary_he: analysis.summary_he,
              summary_en: analysis.summary_en,
              entities: JSON.stringify(analysis.entities),
              matched_keywords: JSON.stringify(analysis.matched_keywords),
              model_used: ANALYSIS_MODEL,
            });
            relevantCount++;
            console.log(
              `Full analysis for: ${article.title?.slice(0, 50)} (${Math.round(headlineScore * 100)}%)`,
            );
          } catch (err) {
            console.error(`Analysis failed for '${article.title?.slice(0, 50)}':`, err);
          }
        } else {
          // Lightweight analysis record with just the headline score
          try {
            await db.from("analyses").insert({
              article_id: articleId,
              relevance_score: Math.round(headlineScore * 1000) / 1000,
              model_used: "headline-scoring",
            });
          } catch {
            // Non-critical
          }
        }
      } catch (err) {
        console.error(`Failed to persist article '${article.title?.slice(0, 50)}':`, err);
      }
    }

    console.log(`Persisted ${newArticles} new articles (${relevantCount} with full analysis)`);

    const result: ProcessResult = {
      articles_found: uniqueArticles.length,
      articles_relevant: relevantCount,
      new_articles: newArticles,
    };

    return jsonResponse(result);
  } catch (err) {
    console.error("scan-process error:", err);
    return errorResponse(String(err));
  }
});
