"""RAG-powered content generation service.

Generates draft communications content (social posts, press releases,
talking points, etc.) grounded in article analysis and knowledge-base
context.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Literal

import anthropic

from src.config import Settings, get_settings

logger = logging.getLogger("sentinel.generation")

ContentType = Literal[
    "social_post",
    "press_release",
    "talking_points",
    "internal_brief",
    "response_draft",
]

_DEFAULT_MODEL = "claude-sonnet-4-20250514"

# System prompts per content type
_SYSTEM_PROMPTS: dict[str, str] = {
    "social_post": (
        "You are a social media strategist for an Israeli communications firm. "
        "Write a concise, engaging social media post in both Hebrew and English."
    ),
    "press_release": (
        "You are a PR professional. Draft a professional press release "
        "based on the provided article and analysis."
    ),
    "talking_points": (
        "You are a media advisor. Create clear, concise talking points "
        "for a spokesperson to use in interviews."
    ),
    "internal_brief": (
        "You are a communications analyst. Write an internal briefing "
        "document summarizing the situation and recommended actions."
    ),
    "response_draft": (
        "You are a crisis communications specialist. Draft an appropriate "
        "public response to the coverage described."
    ),
}


class ContentGenerator:
    """Generate communications content using Claude with optional RAG context.

    Parameters:
        settings: Application settings.
        client:   An optional pre-configured ``anthropic.AsyncAnthropic`` client.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        client: anthropic.AsyncAnthropic | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._client = client or anthropic.AsyncAnthropic(
            api_key=self._settings.anthropic_api_key,
        )

    async def generate_content(
        self,
        article: dict[str, Any],
        analysis: dict[str, Any],
        content_type: ContentType,
        kb_context: str | None = None,
    ) -> dict[str, Any]:
        """Generate a piece of communications content.

        Parameters:
            article:      The normalised article dict.
            analysis:     The analysis dict produced by ``ArticleAnalyzer``.
            content_type: The kind of content to generate.
            kb_context:   Optional knowledge-base context retrieved via
                          RAG embeddings search.  When provided it is
                          injected into the prompt so the model can
                          ground its output in organisational knowledge.

        Returns:
            A dict with ``content_type``, ``content_he``, ``content_en``,
            and ``metadata``.
        """
        system_prompt = _SYSTEM_PROMPTS.get(content_type, _SYSTEM_PROMPTS["internal_brief"])

        # Build the user message with all available context
        context_parts: list[str] = [
            f"## Article\nTitle: {article.get('title', '')}\n\n{article.get('content', '')[:6000]}",
            f"## Analysis\n{json.dumps(analysis, ensure_ascii=False, indent=2)}",
        ]

        if kb_context:
            context_parts.append(
                f"## Organisational Knowledge Base Context\n{kb_context}"
            )

        context_parts.append(
            f"## Task\nGenerate a {content_type.replace('_', ' ')} based on the above.\n"
            "Return a JSON object with:\n"
            '{\n  "content_he": "<content in Hebrew>",\n'
            '  "content_en": "<content in English>",\n'
            '  "metadata": {"tone": "...", "target_audience": "...", "key_messages": [...]}\n}'
        )

        user_message = "\n\n".join(context_parts)

        empty_result: dict[str, Any] = {
            "content_type": content_type,
            "content_he": "",
            "content_en": "",
            "metadata": {},
        }

        try:
            response = await self._client.messages.create(
                model=_DEFAULT_MODEL,
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )

            raw_text = response.content[0].text.strip()

            # Strip markdown fences if present
            if raw_text.startswith("```"):
                raw_text = raw_text.split("\n", 1)[-1]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                raw_text = raw_text.strip()

            result = json.loads(raw_text)

            generated: dict[str, Any] = {
                "content_type": content_type,
                "content_he": result.get("content_he", ""),
                "content_en": result.get("content_en", ""),
                "metadata": result.get("metadata", {}),
            }

            logger.info("Generated %s content for article '%s'.", content_type, article.get("title", "")[:50])
            return generated

        except (json.JSONDecodeError, KeyError, IndexError) as exc:
            logger.warning("Failed to parse generated content: %s", exc)
            return empty_result
        except anthropic.APIError as exc:
            logger.error("Anthropic API error generating content: %s", exc)
            return empty_result
