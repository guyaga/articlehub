"""Scan orchestrator -- the main pipeline for a single media scan."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from src.config import get_settings
from src.db import get_supabase
from src.services.analysis import ArticleAnalyzer
from src.services.scraping import SourceScraper

logger = logging.getLogger("sentinel.orchestrator")


async def run_scan() -> str | None:
    """Execute a full media scan pipeline.

    Saves ALL discovered articles to the database (not just relevant ones).
    Only performs full AI analysis on articles above the relevance threshold.
    """
    settings = get_settings()
    db = get_supabase()
    scan_id = str(uuid.uuid4())

    try:
        # Step 1 — create scan record
        db.table("scans").insert({
            "id": scan_id,
            "status": "running",
            "scan_type": "manual",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        logger.info("Scan %s started.", scan_id)

        # Step 2 — fetch active sources
        sources_resp = db.table("sources").select("*").eq("is_active", True).execute()
        sources = sources_resp.data or []
        if not sources:
            logger.warning("No active sources. Completing scan early.")
            _update_scan(db, scan_id, "completed", {
                "total_sources": 0, "completed_at": datetime.now(timezone.utc).isoformat()
            })
            return scan_id

        logger.info("Found %d active source(s).", len(sources))

        # Step 3 — scrape all sources in parallel
        scraper = SourceScraper(settings=settings)
        all_articles: list[dict[str, Any]] = []
        failed_sources = 0

        sem = asyncio.Semaphore(settings.max_concurrent_scrapes)

        async def scrape_one(source: dict[str, Any]) -> list[dict[str, Any]]:
            nonlocal failed_sources
            async with sem:
                try:
                    articles = await scraper.scrape_source(source)
                    db.table("scan_source_results").insert({
                        "scan_id": scan_id,
                        "source_id": source["id"],
                        "status": "completed",
                        "articles_found": len(articles),
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                    }).execute()
                    return articles
                except Exception as exc:
                    failed_sources += 1
                    logger.error("Error scraping %s: %s", source.get("name"), exc)
                    try:
                        db.table("scan_source_results").insert({
                            "scan_id": scan_id,
                            "source_id": source["id"],
                            "status": "failed",
                            "error_message": str(exc)[:500],
                            "completed_at": datetime.now(timezone.utc).isoformat(),
                        }).execute()
                    except Exception:
                        pass
                    return []

        results = await asyncio.gather(*[scrape_one(s) for s in sources])
        await scraper.close()

        for batch in results:
            all_articles.extend(batch)

        logger.info("Scraped %d article(s) from %d source(s).", len(all_articles), len(sources))

        # Step 4 — deduplicate by URL hash
        seen: set[str] = set()
        unique_articles: list[dict[str, Any]] = []
        for article in all_articles:
            url = article.get("url", "")
            if not url:
                continue
            url_hash = hashlib.md5(url.encode()).hexdigest()
            if url_hash not in seen:
                seen.add(url_hash)
                article["url_hash"] = url_hash
                unique_articles.append(article)

        logger.info("Dedup: %d -> %d unique articles.", len(all_articles), len(unique_articles))

        # Step 5 — fetch keywords and score headlines
        kw_resp = db.table("keywords").select("*").eq("is_active", True).execute()
        keywords = kw_resp.data or []

        analyzer = ArticleAnalyzer(settings=settings)
        scored: list[tuple[dict[str, Any], float]] = []

        for article in unique_articles:
            title = article.get("title", "")
            lead = (article.get("content") or "")[:300]
            score = await analyzer.score_headline(title, keywords, lead=lead)
            scored.append((article, score))

        # Step 6 — persist ALL articles (not just relevant ones)
        threshold = settings.relevance_threshold
        relevant_count = 0

        # Check existing URL hashes to skip duplicates from prior scans
        existing_hashes: set[str] = set()
        try:
            hashes_to_check = [a["url_hash"] for a, _ in scored]
            # Check in batches of 50
            for i in range(0, len(hashes_to_check), 50):
                batch = hashes_to_check[i:i + 50]
                resp = db.table("articles").select("url_hash").in_("url_hash", batch).execute()
                for row in (resp.data or []):
                    existing_hashes.add(row["url_hash"])
        except Exception as exc:
            logger.warning("Could not check existing hashes: %s", exc)

        new_articles = 0
        for article, headline_score in scored:
            url_hash = article.get("url_hash", "")
            if url_hash in existing_hashes:
                continue  # Already in DB from a previous scan

            try:
                article_id = str(uuid.uuid4())
                content = article.get("content", "")

                # Persist article
                db.table("articles").insert({
                    "id": article_id,
                    "source_id": article.get("source_id"),
                    "url": article["url"],
                    "url_hash": url_hash,
                    "title": article.get("title"),
                    "author": article.get("author"),
                    "published_at": article.get("published_at"),
                    "content": content[:50000] if content else None,
                    "content_length": len(content) if content else 0,
                }).execute()

                # Link article to scan
                db.table("article_scans").insert({
                    "article_id": article_id,
                    "scan_id": scan_id,
                }).execute()

                new_articles += 1

                # Full AI analysis only for articles above threshold
                if headline_score >= threshold:
                    try:
                        analysis = await analyzer.analyze_article(article, keywords)
                        db.table("analyses").insert({
                            "article_id": article_id,
                            "relevance_score": analysis["relevance_score"],
                            "sentiment": analysis["sentiment"],
                            "summary_he": analysis["summary_he"],
                            "summary_en": analysis["summary_en"],
                            "entities": json.dumps(analysis["entities"]),
                            "matched_keywords": json.dumps(analysis["matched_keywords"]),
                            "model_used": "claude-sonnet-4-5-20250929",
                        }).execute()
                        relevant_count += 1
                        logger.info("Full analysis for: %s (%.0f%%)", article.get("title", "")[:50], headline_score * 100)
                    except Exception as exc:
                        logger.error("Analysis failed for '%s': %s", article.get("title", "")[:50], exc)
                else:
                    # Store basic headline score as a lightweight analysis
                    try:
                        db.table("analyses").insert({
                            "article_id": article_id,
                            "relevance_score": round(headline_score, 3),
                            "model_used": "headline-scoring",
                        }).execute()
                    except Exception:
                        pass

            except Exception as exc:
                logger.error("Failed to persist article '%s': %s", article.get("title", "")[:50], exc)

        logger.info("Persisted %d new articles (%d with full analysis).", new_articles, relevant_count)

        # Step 7 — update scan status
        successful = len(sources) - failed_sources
        _update_scan(db, scan_id, "completed" if failed_sources < len(sources) else "partial", {
            "total_sources": len(sources),
            "successful_sources": successful,
            "failed_sources": failed_sources,
            "articles_found": len(unique_articles),
            "articles_relevant": relevant_count,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })

        logger.info("Scan %s completed. %d total, %d relevant.", scan_id, new_articles, relevant_count)
        return scan_id

    except Exception as exc:
        logger.exception("Scan %s failed: %s", scan_id, exc)
        _update_scan(db, scan_id, "failed", {
            "error_log": json.dumps({"error": str(exc)}),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        return None


def _update_scan(db: Any, scan_id: str, status: str, extra: dict[str, Any] | None = None) -> None:
    try:
        data: dict[str, Any] = {"status": status}
        if extra:
            data.update(extra)
        db.table("scans").update(data).eq("id", scan_id).execute()
    except Exception as exc:
        logger.error("Failed to update scan %s: %s", scan_id, exc)
