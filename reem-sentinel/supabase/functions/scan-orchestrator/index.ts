/**
 * scan-orchestrator: Main pipeline controller.
 * Creates scan record, fans out scraping, collects results,
 * calls scan-process, and updates scan status.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getSupabase } from "../_shared/supabase-client.ts";
import { MAX_CONCURRENT_SCRAPES } from "../_shared/constants.ts";
import type { Source, ScrapedArticle, ScrapeResult, ProcessResult } from "../_shared/types.ts";

/**
 * Execute promises in batches to limit concurrency.
 */
async function batchExecute<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const db = getSupabase();
  const scanId = crypto.randomUUID();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Step 1 — Create scan record
    const body = await req.json().catch(() => ({}));
    const scanType = body.trigger === "scheduled" ? "scheduled" : "manual";

    await db.from("scans").insert({
      id: scanId,
      status: "running",
      scan_type: scanType,
      started_at: new Date().toISOString(),
    });

    console.log(`Scan ${scanId} started (${scanType})`);

    // Step 2 — Fetch active sources
    const { data: sources } = await db
      .from("sources")
      .select("*")
      .eq("is_active", true);

    if (!sources || sources.length === 0) {
      console.log("No active sources. Completing scan early.");
      await updateScan(db, scanId, "completed", {
        total_sources: 0,
        completed_at: new Date().toISOString(),
      });
      return jsonResponse({ scan_id: scanId, status: "completed", articles_found: 0 });
    }

    console.log(`Found ${sources.length} active source(s)`);

    // Step 3 — Fan out to scan-scrape for each source
    const scrapeUrl = `${supabaseUrl}/functions/v1/scan-scrape`;
    let failedSources = 0;
    const allArticles: ScrapedArticle[] = [];

    const scrapeTasks = (sources as Source[]).map((source) => async () => {
      const startedAt = new Date().toISOString();
      try {
        const response = await fetch(scrapeUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ source }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const result: ScrapeResult = await response.json();

        // Record source result
        await db.from("scan_source_results").insert({
          scan_id: scanId,
          source_id: source.id,
          status: result.status === "ok" ? "completed" : "failed",
          articles_found: result.articles.length,
          error_message: result.error ?? null,
          completed_at: new Date().toISOString(),
        });

        return result.articles;
      } catch (err) {
        failedSources++;
        console.error(`Error scraping ${source.name}:`, err);
        try {
          await db.from("scan_source_results").insert({
            scan_id: scanId,
            source_id: source.id,
            status: "failed",
            error_message: String(err).slice(0, 500),
            completed_at: new Date().toISOString(),
          });
        } catch {
          // Non-critical
        }
        return [] as ScrapedArticle[];
      }
    });

    const scrapeResults = await batchExecute(scrapeTasks, MAX_CONCURRENT_SCRAPES);
    for (const batch of scrapeResults) {
      allArticles.push(...batch);
    }

    console.log(`Scraped ${allArticles.length} article(s) from ${sources.length} source(s)`);

    // Step 4 — Call scan-process in parallel batches.
    // Strip content to lead text to keep payloads manageable.
    const LEAD_LIMIT = 6_000;
    const BATCH_SIZE = 120;
    const processUrl = `${supabaseUrl}/functions/v1/scan-process`;

    const trimmedArticles = allArticles.map((a) => ({
      ...a,
      content: a.content ? a.content.slice(0, LEAD_LIMIT) : null,
    }));

    let processResult: ProcessResult = {
      articles_found: allArticles.length,
      articles_relevant: 0,
      new_articles: 0,
    };

    // Build batches
    const batches: ScrapedArticle[][] = [];
    for (let i = 0; i < trimmedArticles.length; i += BATCH_SIZE) {
      batches.push(trimmedArticles.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${batches.length} batch(es) in parallel`);

    // Fire all batches in parallel
    const batchPromises = batches.map(async (batch, idx) => {
      try {
        const processResponse = await fetch(processUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scan_id: scanId, articles: batch }),
        });

        if (processResponse.ok) {
          return await processResponse.json() as ProcessResult;
        } else {
          console.error(`Batch ${idx + 1} failed:`, await processResponse.text());
          return null;
        }
      } catch (err) {
        console.error(`Batch ${idx + 1} error:`, err);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    for (const br of batchResults) {
      if (br) {
        processResult.articles_relevant += br.articles_relevant;
        processResult.new_articles += br.new_articles;
      }
    }

    // Step 5 — Update scan status
    const successfulSources = sources.length - failedSources;
    const finalStatus = failedSources < sources.length ? "completed" : "partial";

    await updateScan(db, scanId, finalStatus, {
      total_sources: sources.length,
      successful_sources: successfulSources,
      failed_sources: failedSources,
      articles_found: processResult.articles_found,
      articles_relevant: processResult.articles_relevant,
      completed_at: new Date().toISOString(),
    });

    console.log(
      `Scan ${scanId} ${finalStatus}. ${processResult.new_articles} new, ${processResult.articles_relevant} relevant.`,
    );

    return jsonResponse({
      scan_id: scanId,
      status: finalStatus,
      ...processResult,
    });
  } catch (err) {
    console.error(`Scan ${scanId} failed:`, err);
    await updateScan(db, scanId, "failed", {
      error_log: { error: String(err) },
      completed_at: new Date().toISOString(),
    });
    return errorResponse(String(err));
  }
});

async function updateScan(
  db: ReturnType<typeof getSupabase>,
  scanId: string,
  status: string,
  extra?: Record<string, unknown>,
) {
  try {
    const data: Record<string, unknown> = { status, ...extra };
    await db.from("scans").update(data).eq("id", scanId);
  } catch (err) {
    console.error(`Failed to update scan ${scanId}:`, err);
  }
}
