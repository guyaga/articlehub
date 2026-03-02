/** RSS feed parsing using rss-parser npm package. */

import Parser from "npm:rss-parser@3.13.0";
import type { ScrapedArticle } from "./types.ts";

const parser = new Parser({
  timeout: 30_000,
  headers: { "User-Agent": "ReeM-Sentinel/0.1" },
});

export async function parseRssFeed(
  rssUrl: string,
  sourceId: string,
): Promise<ScrapedArticle[]> {
  const feed = await parser.parseURL(rssUrl);
  const articles: ScrapedArticle[] = [];

  for (const item of feed.items ?? []) {
    const url = item.link ?? "";
    if (!url) continue;

    articles.push({
      url,
      title: item.title ?? "",
      author: item.creator ?? item["dc:creator"] ?? null,
      published_at: item.isoDate ?? item.pubDate ?? null,
      content: item["content:encoded"] ?? item.contentSnippet ?? item.content ?? "",
      source_id: sourceId,
    });
  }

  return articles;
}
