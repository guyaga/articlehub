/** Firecrawl API client for web scraping. */

import { FIRECRAWL_BASE_URL } from "./constants.ts";
import type { ScrapedArticle } from "./types.ts";

export async function scrapeWithFirecrawl(
  pageUrl: string,
  sourceId: string,
): Promise<ScrapedArticle[]> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("Missing FIRECRAWL_API_KEY");

  const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: pageUrl,
      formats: ["markdown"],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Firecrawl error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const firecrawlData = data.data ?? {};
  const metadata = firecrawlData.metadata ?? {};

  return [
    {
      url: pageUrl,
      title: metadata.title ?? "",
      author: metadata.author ?? null,
      published_at: metadata.publishedTime ?? null,
      content: firecrawlData.markdown ?? "",
      source_id: sourceId,
    },
  ];
}
