/**
 * scan-process: Keyword match → Firecrawl → Claude analysis pipeline.
 * Receives scraped articles, deduplicates, matches keywords (instant),
 * fetches full content via Firecrawl for matches, then runs Claude analysis.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getSupabase } from "../_shared/supabase-client.ts";
import { analyzeArticle } from "../_shared/analysis.ts";
import { matchKeywords } from "../_shared/keyword-match.ts";
import { scrapeWithFirecrawl } from "../_shared/firecrawl.ts";
import { md5 } from "../_shared/md5.ts";
import {
  HASH_BATCH_SIZE,
  CONTENT_TRUNCATE_LENGTH,
  ANALYSIS_MODEL,
  FIRECRAWL_CONCURRENCY,
  PROCESS_TIME_LIMIT_MS,
} from "../_shared/constants.ts";
import type { ScrapedArticle, Keyword, ProcessResult } from "../_shared/types.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const startTime = Date.now();
  const timeLeft = () => PROCESS_TIME_LIMIT_MS - (Date.now() - startTime);

  try {
    const { scan_id, articles } = (await req.json()) as {
      scan_id: string;
      articles: ScrapedArticle[];
    };

    if (!scan_id) return errorResponse("Missing scan_id", 400);

    const db = getSupabase();

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
    const newUniqueArticles = uniqueArticles.filter(
      (a) => !existingHashes.has(a.url_hash!),
    );

    if (newUniqueArticles.length === 0) {
      console.log("No new articles to process");
      return jsonResponse({
        articles_found: uniqueArticles.length,
        articles_relevant: 0,
        articles_drilled: 0,
        new_articles: 0,
      });
    }

    // ========== PHASE A: Keyword match + persist ALL articles ==========
    const matchedArticleIds: Array<{
      articleId: string;
      article: ScrapedArticle;
      matchedTerms: string[];
    }> = [];
    let newArticles = 0;

    for (const article of newUniqueArticles) {
      if (timeLeft() < 5_000) {
        console.warn("Time guard: stopping article persistence");
        break;
      }

      try {
        const articleId = crypto.randomUUID();
        const content = article.content ?? "";

        // Keyword match (instant, no API call)
        const match = matchKeywords(article.title ?? "", content, kw);

        // Persist article to DB
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

        if (match.matched) {
          matchedArticleIds.push({ articleId, article, matchedTerms: match.matchedTerms });
        }
      } catch (err) {
        console.error(`Failed to persist article '${article.title?.slice(0, 50)}':`, err);
      }
    }

    console.log(
      `Persisted ${newArticles} articles, ${matchedArticleIds.length} matched keywords`,
    );

    // ========== PHASE B: Firecrawl full content for matched articles ==========
    let drilledCount = 0;
    let analysisCount = 0;

    // Process in batches of FIRECRAWL_CONCURRENCY
    for (let i = 0; i < matchedArticleIds.length; i += FIRECRAWL_CONCURRENCY) {
      if (timeLeft() < 10_000) {
        console.warn("Time guard: stopping Firecrawl phase");
        // Save keyword-match records for remaining unprocessed matches
        for (let j = i; j < matchedArticleIds.length; j++) {
          const { articleId, matchedTerms } = matchedArticleIds[j];
          try {
            await db.from("analyses").insert({
              article_id: articleId,
              relevance_score: 1.0,
              matched_keywords: JSON.stringify(matchedTerms),
              model_used: "keyword-match",
            });
          } catch { /* non-critical */ }
        }
        break;
      }

      const batch = matchedArticleIds.slice(i, i + FIRECRAWL_CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map(async ({ articleId, article, matchedTerms }) => {
          // Firecrawl scrape
          let fullContent = "";
          try {
            const scraped = await scrapeWithFirecrawl(article.url, article.source_id);
            fullContent = scraped[0]?.content ?? "";
          } catch (err) {
            console.error(`Firecrawl failed for ${article.url}: ${err}`);
          }

          if (fullContent) {
            // Update article with full content
            await db.from("articles").update({
              content: fullContent.slice(0, CONTENT_TRUNCATE_LENGTH),
              content_length: fullContent.length,
              is_drilled_down: true,
            }).eq("id", articleId);

            drilledCount++;

            // ========== PHASE C: Claude analysis on full content ==========
            try {
              const enrichedArticle: ScrapedArticle = {
                ...article,
                content: fullContent,
              };
              const analysis = await analyzeArticle(enrichedArticle, kw);

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

              analysisCount++;
              console.log(
                `Analyzed: ${article.title?.slice(0, 50)} (${fullContent.length} chars)`,
              );
            } catch (err) {
              console.error(`Analysis failed for '${article.title?.slice(0, 50)}':`, err);
              // Save keyword-match fallback
              await db.from("analyses").insert({
                article_id: articleId,
                relevance_score: 1.0,
                matched_keywords: JSON.stringify(matchedTerms),
                model_used: "keyword-match",
              }).catch(() => {});
            }
          } else {
            // ========== PHASE D: Keyword-match fallback (no full content) ==========
            await db.from("analyses").insert({
              article_id: articleId,
              relevance_score: 1.0,
              matched_keywords: JSON.stringify(matchedTerms),
              model_used: "keyword-match",
            }).catch(() => {});
          }
        }),
      );

      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        console.warn(`${failures.length}/${batch.length} batch items failed`);
      }
    }

    console.log(
      `Done: ${newArticles} new, ${matchedArticleIds.length} matched, ` +
      `${drilledCount} drilled, ${analysisCount} analyzed ` +
      `(${Math.round((Date.now() - startTime) / 1000)}s)`,
    );

    const result: ProcessResult = {
      articles_found: uniqueArticles.length,
      articles_relevant: matchedArticleIds.length,
      articles_drilled: drilledCount,
      new_articles: newArticles,
    };

    return jsonResponse(result);
  } catch (err) {
    console.error("scan-process error:", err);
    return errorResponse(String(err));
  }
});
