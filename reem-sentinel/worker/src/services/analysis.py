"""Article analysis service powered by Claude."""

from __future__ import annotations

import json
import logging
from typing import Any

import anthropic

from src.config import Settings, get_settings

logger = logging.getLogger("sentinel.analysis")

_DEFAULT_MODEL = "claude-sonnet-4-5-20250929"


class ArticleAnalyzer:
    def __init__(
        self,
        settings: Settings | None = None,
        client: anthropic.AsyncAnthropic | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._client = client or anthropic.AsyncAnthropic(
            api_key=self._settings.anthropic_api_key,
        )

    async def score_headline(
        self, title: str, keywords: list[dict[str, Any]], lead: str = "",
    ) -> float:
        if not title and not lead:
            return 0.0

        kw_text = ", ".join(
            f"{k.get('term_he', '')} ({k.get('term_en', '')})" for k in keywords
        )

        lead_section = f"\nSubtitle / Lead: {lead}" if lead else ""

        prompt = (
            "You are a media monitoring assistant for an Israeli public figure. "
            "Rate the relevance of this headline (and subtitle if provided) "
            "to the monitoring keywords.\n\n"
            f"Keywords: {kw_text}\n"
            f"Headline: {title}{lead_section}\n\n"
            'Respond with ONLY a JSON object: {{"relevance_score": <float 0.0-1.0>}}\n'
            "No other text."
        )

        try:
            response = await self._client.messages.create(
                model=_DEFAULT_MODEL,
                max_tokens=64,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            result = json.loads(raw)
            return max(0.0, min(1.0, float(result.get("relevance_score", 0.0))))
        except Exception as exc:
            logger.warning("Headline score failed for '%s': %s", title[:60], exc)
            return 0.0

    async def analyze_article(
        self, article: dict[str, Any], keywords: list[dict[str, Any]]
    ) -> dict[str, Any]:
        title = article.get("title", "")
        content = article.get("content", "")

        if len(content) > 12_000:
            content = content[:12_000] + "\n\n[Content truncated]"

        kw_text = ", ".join(
            f"{k.get('term_he', '')} ({k.get('term_en', '')})" for k in keywords
        )

        prompt = (
            "You are a media analysis assistant for an Israeli public figure. "
            "Analyze this article and return a structured JSON response.\n\n"
            f"Monitoring keywords: {kw_text}\n\n"
            f"Title: {title}\n\nContent:\n{content}\n\n"
            "Return ONLY a JSON object with these exact fields:\n"
            "{\n"
            '  "relevance_score": <float 0.0-1.0>,\n'
            '  "sentiment": "<supportive|opposing|neutral|mixed>",\n'
            '  "summary_he": "<2-3 sentence summary in Hebrew>",\n'
            '  "summary_en": "<2-3 sentence summary in English>",\n'
            '  "entities": [{"type": "person|organization|party|government_body|other", "name": "<name>"}],\n'
            '  "matched_keywords": ["<keyword1>", "..."]\n'
            "}\n"
            "No other text outside the JSON."
        )

        empty: dict[str, Any] = {
            "relevance_score": 0.0,
            "sentiment": "neutral",
            "summary_he": "",
            "summary_en": "",
            "entities": [],
            "matched_keywords": [],
        }

        try:
            response = await self._client.messages.create(
                model=_DEFAULT_MODEL,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

            result = json.loads(raw)

            analysis: dict[str, Any] = {
                "relevance_score": max(0.0, min(1.0, float(result.get("relevance_score", 0.0)))),
                "sentiment": result.get("sentiment", "neutral"),
                "summary_he": result.get("summary_he", ""),
                "summary_en": result.get("summary_en", ""),
                "entities": result.get("entities", []),
                "matched_keywords": result.get("matched_keywords", []),
            }

            logger.info(
                "Analyzed '%s' -- relevance=%.2f, sentiment=%s",
                title[:60], analysis["relevance_score"], analysis["sentiment"],
            )
            return analysis

        except Exception as exc:
            logger.warning("Analysis failed for '%s': %s", title[:60], exc)
            return empty
