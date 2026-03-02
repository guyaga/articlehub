/**
 * scan-scrape: Per-source scraping function.
 * Receives a single source object, routes to RSS or Firecrawl,
 * returns scraped articles.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { parseRssFeed } from "../_shared/rss-parser.ts";
import { scrapeWithFirecrawl } from "../_shared/firecrawl.ts";
import type { Source, ScrapeResult } from "../_shared/types.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { source } = (await req.json()) as { source: Source };

    if (!source?.id) {
      return errorResponse("Missing source in request body", 400);
    }

    const method = source.ingestion_method ?? "rss";
    let result: ScrapeResult;

    try {
      if (method === "firecrawl") {
        const articles = await scrapeWithFirecrawl(source.url, source.id);
        result = { articles, source_id: source.id, status: "ok" };
      } else {
        const rssUrl = source.rss_url ?? source.url;
        const articles = await parseRssFeed(rssUrl, source.id);
        result = { articles, source_id: source.id, status: "ok" };
      }
    } catch (err) {
      console.error(`Scrape error for ${source.name}:`, err);
      result = {
        articles: [],
        source_id: source.id,
        status: "error",
        error: String(err).slice(0, 500),
      };
    }

    return jsonResponse(result);
  } catch (err) {
    console.error("scan-scrape error:", err);
    return errorResponse(String(err));
  }
});
