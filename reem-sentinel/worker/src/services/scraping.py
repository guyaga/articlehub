"""Source scraping service."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import feedparser
import httpx

from src.config import Settings, get_settings

logger = logging.getLogger("sentinel.scraping")


class SourceScraper:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._http_client: httpx.AsyncClient | None = None

    async def _get_http_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=httpx.Timeout(30.0, connect=10.0),
                headers={"User-Agent": "ReeM-Sentinel/0.1"},
            )
        return self._http_client

    async def close(self) -> None:
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()

    async def scrape_rss(self, source: dict[str, Any]) -> list[dict[str, Any]]:
        rss_url: str | None = source.get("rss_url") or source.get("url")
        source_id: str = source["id"]
        if not rss_url:
            logger.warning("No RSS URL for source %s", source.get("name"))
            return []

        logger.info("Scraping RSS feed: %s (%s)", source.get("name"), rss_url)

        try:
            client = await self._get_http_client()
            response = await client.get(rss_url)
            response.raise_for_status()

            feed = feedparser.parse(response.text)

            articles: list[dict[str, Any]] = []
            for entry in feed.entries:
                published_at = self._parse_feed_date(entry)
                article: dict[str, Any] = {
                    "url": entry.get("link", ""),
                    "title": entry.get("title", ""),
                    "author": entry.get("author", None),
                    "published_at": published_at,
                    "content": self._extract_feed_content(entry),
                    "source_id": source_id,
                }
                if article["url"]:
                    articles.append(article)

            logger.info("RSS %s returned %d articles.", source.get("name"), len(articles))
            return articles

        except Exception as exc:
            logger.error("Error scraping RSS %s: %s", source.get("name"), exc)
            return []

    async def scrape_firecrawl(self, source: dict[str, Any]) -> list[dict[str, Any]]:
        page_url: str = source["url"]
        source_id: str = source["id"]
        logger.info("Scraping via Firecrawl: %s (%s)", source.get("name"), page_url)

        try:
            client = await self._get_http_client()
            response = await client.post(
                f"{self._settings.firecrawl_base_url}/scrape",
                headers={
                    "Authorization": f"Bearer {self._settings.firecrawl_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "url": page_url,
                    "formats": ["markdown"],
                },
            )
            response.raise_for_status()
            data = response.json()

            firecrawl_data = data.get("data", {})
            metadata = firecrawl_data.get("metadata", {})

            article: dict[str, Any] = {
                "url": page_url,
                "title": metadata.get("title", ""),
                "author": metadata.get("author", None),
                "published_at": metadata.get("publishedTime", None),
                "content": firecrawl_data.get("markdown", ""),
                "source_id": source_id,
            }

            logger.info("Firecrawl returned content for %s.", source.get("name"))
            return [article]

        except Exception as exc:
            logger.error("Firecrawl error for %s: %s", source.get("name"), exc)
            return []

    async def scrape_source(self, source: dict[str, Any]) -> list[dict[str, Any]]:
        method = source.get("ingestion_method", "rss")
        if method == "firecrawl":
            return await self.scrape_firecrawl(source)
        return await self.scrape_rss(source)

    @staticmethod
    def _parse_feed_date(entry: Any) -> str | None:
        published_parsed = entry.get("published_parsed")
        if published_parsed:
            try:
                dt = datetime(*published_parsed[:6], tzinfo=timezone.utc)
                return dt.isoformat()
            except (TypeError, ValueError):
                pass
        return entry.get("published", None)

    @staticmethod
    def _extract_feed_content(entry: Any) -> str:
        content_blocks = entry.get("content", [])
        if content_blocks and isinstance(content_blocks, list):
            return content_blocks[0].get("value", "")
        return entry.get("summary", entry.get("description", ""))
