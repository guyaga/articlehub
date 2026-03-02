"""Daily briefing composition and delivery service.

Composes an HTML email brief from scan results and sends it via
the Resend transactional email API.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import resend

from src.config import Settings, get_settings
from src.db import get_supabase

logger = logging.getLogger("sentinel.briefing")


class BriefComposer:
    """Compose and send daily media monitoring briefs.

    Parameters:
        settings: Application settings.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        resend.api_key = self._settings.resend_api_key

    # ------------------------------------------------------------------
    # Compose
    # ------------------------------------------------------------------

    async def compose_brief(
        self,
        scan_id: str,
        articles: list[dict[str, Any]],
        analyses: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Compose an HTML brief from scanned articles and their analyses.

        Creates the brief record in Supabase and returns a dict with
        the ``brief_id`` and rendered ``html`` content.

        Parameters:
            scan_id:  The ID of the parent scan.
            articles: The list of relevant article dicts.
            analyses: The corresponding analysis dicts (same order).

        Returns:
            A dict with ``brief_id``, ``html``, and ``subject``.
        """
        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y-%m-%d %H:%M")

        # Build HTML sections for each article
        article_sections = self._render_article_sections(articles, analyses)

        subject = f"Sentinel Media Brief - {now.strftime('%d %b %Y %H:%M')}"

        html = self._render_html_template(
            subject=subject,
            date_str=date_str,
            total_articles=len(articles),
            article_sections=article_sections,
            scan_id=scan_id,
        )

        # Persist the brief in Supabase
        db = get_supabase()
        brief_record = {
            "scan_id": scan_id,
            "subject": subject,
            "html_content": html,
            "article_count": len(articles),
            "status": "composed",
            "created_at": now.isoformat(),
        }

        try:
            result = db.table("briefs").insert(brief_record).execute()
            brief_id = result.data[0]["id"] if result.data else None
        except Exception as exc:
            logger.error("Failed to save brief to database: %s", exc)
            brief_id = None

        logger.info("Composed brief '%s' with %d articles.", brief_id, len(articles))
        return {
            "brief_id": brief_id,
            "html": html,
            "subject": subject,
        }

    # ------------------------------------------------------------------
    # Send
    # ------------------------------------------------------------------

    async def send_brief(self, brief_id: str) -> bool:
        """Send a composed brief via Resend email API.

        Fetches the brief from Supabase, retrieves the recipient list
        for the organisation, and sends the email.

        Parameters:
            brief_id: The ID of the brief to send.

        Returns:
            ``True`` if the email was sent successfully, ``False`` otherwise.
        """
        db = get_supabase()

        try:
            # Fetch the brief record
            brief_result = db.table("briefs").select("*").eq("id", brief_id).single().execute()
            brief = brief_result.data

            if not brief:
                logger.error("Brief %s not found.", brief_id)
                return False

            # Fetch recipients for the organisation
            # TODO: Filter by organisation_id once multi-tenancy is wired up
            recipients_result = (
                db.table("profiles")
                .select("email")
                .eq("receive_briefs", True)
                .execute()
            )
            recipients = [r["email"] for r in (recipients_result.data or [])]

            if not recipients:
                logger.warning("No recipients configured for brief %s.", brief_id)
                return False

            # Send via Resend
            email_params: resend.Emails.SendParams = {
                "from": "Sentinel <sentinel@updates.reem-ai.com>",
                "to": recipients,
                "subject": brief["subject"],
                "html": brief["html_content"],
            }
            email_response = resend.Emails.send(email_params)

            # Update brief status
            db.table("briefs").update({
                "status": "sent",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "resend_id": email_response.get("id") if isinstance(email_response, dict) else None,
            }).eq("id", brief_id).execute()

            logger.info("Brief %s sent to %d recipients.", brief_id, len(recipients))
            return True

        except Exception as exc:
            logger.exception("Failed to send brief %s: %s", brief_id, exc)

            # Mark as failed
            try:
                db.table("briefs").update({
                    "status": "failed",
                    "error_message": str(exc),
                }).eq("id", brief_id).execute()
            except Exception:
                pass

            return False

    # ------------------------------------------------------------------
    # HTML rendering helpers
    # ------------------------------------------------------------------

    def _render_article_sections(
        self,
        articles: list[dict[str, Any]],
        analyses: list[dict[str, Any]],
    ) -> str:
        """Render individual article sections as HTML fragments."""
        sections: list[str] = []

        for article, analysis in zip(articles, analyses, strict=False):
            sentiment = analysis.get("sentiment", "neutral")
            sentiment_color = {
                "positive": "#22c55e",
                "negative": "#ef4444",
                "neutral": "#6b7280",
                "mixed": "#f59e0b",
            }.get(sentiment, "#6b7280")

            matched = ", ".join(analysis.get("matched_keywords", [])) or "N/A"
            entities_html = ", ".join(
                e.get("name", "") for e in analysis.get("entities", [])
            ) or "N/A"

            section = f"""
            <div style="border:1px solid #e5e7eb; border-radius:8px; padding:16px; margin-bottom:16px;">
                <h3 style="margin:0 0 8px 0;">
                    <a href="{article.get('url', '#')}" style="color:#1d4ed8; text-decoration:none;">
                        {article.get('title', 'Untitled')}
                    </a>
                </h3>
                <div style="font-size:13px; color:#6b7280; margin-bottom:8px;">
                    {article.get('author', 'Unknown')} &middot;
                    {article.get('published_at', 'N/A')} &middot;
                    <span style="color:{sentiment_color}; font-weight:600;">{sentiment.upper()}</span> &middot;
                    Score: {analysis.get('relevance_score', 0):.0%}
                </div>
                <p style="margin:0 0 8px 0; direction:rtl; text-align:right;">{analysis.get('summary_he', '')}</p>
                <p style="margin:0 0 8px 0;">{analysis.get('summary_en', '')}</p>
                <div style="font-size:12px; color:#9ca3af;">
                    Keywords: {matched} &middot; Entities: {entities_html}
                </div>
            </div>
            """
            sections.append(section)

        return "\n".join(sections)

    def _render_html_template(
        self,
        subject: str,
        date_str: str,
        total_articles: int,
        article_sections: str,
        scan_id: str,
    ) -> str:
        """Render the full HTML email template."""
        return f"""<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{subject}</title>
</head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; margin-top:20px; margin-bottom:20px;">
        <!-- Header -->
        <div style="background:#1e3a5f; color:#ffffff; padding:24px; text-align:center;">
            <h1 style="margin:0; font-size:22px;">Sentinel Media Brief</h1>
            <p style="margin:4px 0 0 0; font-size:14px; opacity:0.8;">{date_str} UTC</p>
        </div>

        <!-- Summary bar -->
        <div style="background:#f0f4f8; padding:12px 24px; font-size:14px; color:#374151; border-bottom:1px solid #e5e7eb;">
            {total_articles} relevant article(s) found &middot; Scan ID: {scan_id[:8]}...
        </div>

        <!-- Articles -->
        <div style="padding:24px;">
            {article_sections if article_sections else '<p style="color:#6b7280;">No relevant articles found in this scan.</p>'}
        </div>

        <!-- Footer -->
        <div style="background:#f9fafb; padding:16px 24px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb;">
            Powered by Reem-AI Sentinel &middot; Scan ID: {scan_id}
        </div>
    </div>
</body>
</html>"""
