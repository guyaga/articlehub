/** HTML email template builder for media briefs. */

interface BriefArticle {
  url: string;
  title: string;
  author: string | null;
  published_at: string | null;
}

interface BriefAnalysis {
  relevance_score: number | null;
  sentiment: string | null;
  summary_he: string | null;
  summary_en: string | null;
  entities: Array<{ name: string }> | string | null;
  matched_keywords: string[] | string | null;
}

const SENTIMENT_COLORS: Record<string, string> = {
  supportive: "#22c55e",
  opposing: "#ef4444",
  neutral: "#6b7280",
  mixed: "#f59e0b",
};

function renderArticleSections(
  articles: BriefArticle[],
  analyses: BriefAnalysis[],
): string {
  const sections: string[] = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const analysis = analyses[i] ?? {};

    const sentiment = (analysis.sentiment ?? "neutral") as string;
    const sentimentColor = SENTIMENT_COLORS[sentiment] ?? "#6b7280";
    const score = analysis.relevance_score ?? 0;

    const matchedKw = Array.isArray(analysis.matched_keywords)
      ? analysis.matched_keywords
      : typeof analysis.matched_keywords === "string"
        ? (() => { try { return JSON.parse(analysis.matched_keywords); } catch { return []; } })()
        : [];

    const entitiesArr = Array.isArray(analysis.entities)
      ? analysis.entities
      : typeof analysis.entities === "string"
        ? (() => { try { return JSON.parse(analysis.entities); } catch { return []; } })()
        : [];

    const matched = matchedKw.join(", ") || "N/A";
    const entitiesHtml = entitiesArr.map((e: { name: string }) => e.name).join(", ") || "N/A";

    sections.push(`
      <div style="border:1px solid #e5e7eb; border-radius:8px; padding:16px; margin-bottom:16px;">
        <h3 style="margin:0 0 8px 0;">
          <a href="${article.url ?? "#"}" style="color:#1d4ed8; text-decoration:none;">
            ${article.title ?? "Untitled"}
          </a>
        </h3>
        <div style="font-size:13px; color:#6b7280; margin-bottom:8px;">
          ${article.author ?? "Unknown"} &middot;
          ${article.published_at ?? "N/A"} &middot;
          <span style="color:${sentimentColor}; font-weight:600;">${sentiment.toUpperCase()}</span> &middot;
          Score: ${Math.round(score * 100)}%
        </div>
        <p style="margin:0 0 8px 0; direction:rtl; text-align:right;">${analysis.summary_he ?? ""}</p>
        <p style="margin:0 0 8px 0;">${analysis.summary_en ?? ""}</p>
        <div style="font-size:12px; color:#9ca3af;">
          Keywords: ${matched} &middot; Entities: ${entitiesHtml}
        </div>
      </div>
    `);
  }

  return sections.join("\n");
}

export function renderBriefHtml(opts: {
  subject: string;
  dateStr: string;
  totalArticles: number;
  articles: BriefArticle[];
  analyses: BriefAnalysis[];
  scanId: string;
}): string {
  const articleSections = renderArticleSections(opts.articles, opts.analyses);

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.subject}</title>
</head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; margin-top:20px; margin-bottom:20px;">
    <!-- Header -->
    <div style="background:#1e3a5f; color:#ffffff; padding:24px; text-align:center;">
      <h1 style="margin:0; font-size:22px;">ArticleHub Media Brief</h1>
      <p style="margin:4px 0 0 0; font-size:14px; opacity:0.8;">${opts.dateStr} UTC</p>
    </div>

    <!-- Summary bar -->
    <div style="background:#f0f4f8; padding:12px 24px; font-size:14px; color:#374151; border-bottom:1px solid #e5e7eb;">
      ${opts.totalArticles} relevant article(s) found &middot; Scan ID: ${opts.scanId.slice(0, 8)}...
    </div>

    <!-- Articles -->
    <div style="padding:24px;">
      ${articleSections || '<p style="color:#6b7280;">No relevant articles found in this scan.</p>'}
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb; padding:16px 24px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb;">
      Powered by ArticleHub &middot; Scan ID: ${opts.scanId}
    </div>
  </div>
</body>
</html>`;
}
