/**
 * send-brief: Email briefing function.
 * Composes an HTML brief from scan results and sends via Resend API.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getSupabase } from "../_shared/supabase-client.ts";
import { renderBriefHtml } from "../_shared/html-brief.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { scan_id } = (await req.json()) as { scan_id: string };
    if (!scan_id) return errorResponse("Missing scan_id", 400);

    const db = getSupabase();
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return errorResponse("Missing RESEND_API_KEY", 500);

    // Fetch relevant articles + analyses for this scan
    const { data: articleScans } = await db
      .from("article_scans")
      .select("article_id")
      .eq("scan_id", scan_id);

    if (!articleScans || articleScans.length === 0) {
      return jsonResponse({ message: "No articles found for this scan", sent: false });
    }

    const articleIds = articleScans.map((as: { article_id: string }) => as.article_id);

    // Fetch articles
    const { data: articles } = await db
      .from("articles")
      .select("id, url, title, author, published_at")
      .in("id", articleIds);

    // Fetch analyses (only those with full analysis, score >= 0.5)
    const { data: analyses } = await db
      .from("analyses")
      .select("*")
      .in("article_id", articleIds)
      .gte("relevance_score", 0.5)
      .neq("model_used", "headline-scoring");

    if (!analyses || analyses.length === 0) {
      return jsonResponse({ message: "No relevant articles to brief on", sent: false });
    }

    // Match articles to their analyses
    const analysisMap = new Map(analyses.map((a: { article_id: string }) => [a.article_id, a]));
    const briefArticles = (articles ?? [])
      .filter((a: { id: string }) => analysisMap.has(a.id))
      .sort((a: { id: string }, b: { id: string }) => {
        const scoreA = (analysisMap.get(a.id) as { relevance_score: number })?.relevance_score ?? 0;
        const scoreB = (analysisMap.get(b.id) as { relevance_score: number })?.relevance_score ?? 0;
        return scoreB - scoreA;
      });

    const briefAnalyses = briefArticles.map((a: { id: string }) => analysisMap.get(a.id)!);

    // Compose HTML
    const now = new Date();
    const dateStr = now.toISOString().replace("T", " ").slice(0, 16);
    const subject = `ArticleHub Media Brief - ${now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}`;

    const html = renderBriefHtml({
      subject,
      dateStr,
      totalArticles: briefArticles.length,
      articles: briefArticles,
      analyses: briefAnalyses,
      scanId: scan_id,
    });

    // Save brief record
    const { data: briefRecord, error: briefErr } = await db
      .from("briefs")
      .insert({
        scan_id,
        html_content: html,
        article_count: briefArticles.length,
        delivery_status: "composed",
      })
      .select()
      .single();

    if (briefErr) {
      console.error("Failed to save brief:", briefErr);
      return errorResponse("Failed to save brief record", 500);
    }

    const briefId = briefRecord.id;

    // Fetch recipients
    const { data: profiles } = await db
      .from("profiles")
      .select("id, email:id")
      .eq("receive_briefs", true);

    // Get emails from auth.users via profiles
    // Since profiles links to auth.users, we need user emails
    const { data: users } = await db.auth.admin.listUsers();
    const profileIds = new Set((profiles ?? []).map((p: { id: string }) => p.id));
    const recipients = (users?.users ?? [])
      .filter((u: { id: string }) => profileIds.has(u.id))
      .map((u: { email: string }) => u.email)
      .filter(Boolean);

    if (recipients.length === 0) {
      console.log("No recipients configured for brief");
      return jsonResponse({ brief_id: briefId, sent: false, message: "No recipients" });
    }

    // Send via Resend REST API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ArticleHub <alerts@bestguy.ai>",
        to: recipients,
        subject,
        html,
      }),
    });

    const resendResult = await resendResponse.json();

    if (resendResponse.ok) {
      // Update brief status
      await db
        .from("briefs")
        .update({
          delivery_status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", briefId);

      // Record per-recipient delivery
      for (const profile of profiles ?? []) {
        await db.from("brief_recipients").insert({
          brief_id: briefId,
          profile_id: profile.id,
          delivery_status: "sent",
          delivered_at: new Date().toISOString(),
        });
      }

      console.log(`Brief ${briefId} sent to ${recipients.length} recipients`);
      return jsonResponse({ brief_id: briefId, sent: true, recipients: recipients.length });
    } else {
      // Mark as failed
      await db
        .from("briefs")
        .update({ delivery_status: "failed" })
        .eq("id", briefId);

      console.error("Resend API error:", resendResult);
      return errorResponse(`Email delivery failed: ${JSON.stringify(resendResult)}`, 502);
    }
  } catch (err) {
    console.error("send-brief error:", err);
    return errorResponse(String(err));
  }
});
