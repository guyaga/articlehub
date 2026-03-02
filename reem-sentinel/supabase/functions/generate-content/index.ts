/**
 * generate-content: AI content generation function.
 * Callable from frontend (manual trigger per article).
 * Generates social posts, press releases, talking points, etc.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getSupabase } from "../_shared/supabase-client.ts";
import { getAnthropic, stripCodeFences } from "../_shared/anthropic-client.ts";
import { SYSTEM_PROMPTS } from "../_shared/generation-prompts.ts";
import { GENERATION_MODEL, GENERATION_MAX_TOKENS, GENERATION_CONTENT_LIMIT } from "../_shared/constants.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { article_id, content_type } = (await req.json()) as {
      article_id: string;
      content_type: string;
    };

    if (!article_id || !content_type) {
      return errorResponse("Missing article_id or content_type", 400);
    }

    const db = getSupabase();

    // Fetch article
    const { data: article, error: articleErr } = await db
      .from("articles")
      .select("*")
      .eq("id", article_id)
      .single();

    if (articleErr || !article) {
      return errorResponse("Article not found", 404);
    }

    // Fetch analysis
    const { data: analysis } = await db
      .from("analyses")
      .select("*")
      .eq("article_id", article_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Optionally fetch KB context for RAG
    let kbContext: string | null = null;
    // TODO: Implement RAG context retrieval when embeddings are ready

    // Build prompts
    const systemPrompt = SYSTEM_PROMPTS[content_type] ?? SYSTEM_PROMPTS["internal_brief"];

    const contextParts: string[] = [
      `## Article\nTitle: ${article.title ?? ""}\n\n${(article.content ?? "").slice(0, GENERATION_CONTENT_LIMIT)}`,
      `## Analysis\n${JSON.stringify(analysis ?? {}, null, 2)}`,
    ];

    if (kbContext) {
      contextParts.push(`## Organisational Knowledge Base Context\n${kbContext}`);
    }

    contextParts.push(
      `## Task\nGenerate a ${content_type.replace(/_/g, " ")} based on the above.\n` +
      "Return a JSON object with:\n" +
      '{\n  "content_he": "<content in Hebrew>",\n' +
      '  "content_en": "<content in English>",\n' +
      '  "metadata": {"tone": "...", "target_audience": "...", "key_messages": [...]}\n}',
    );

    const userMessage = contextParts.join("\n\n");

    // Call Claude
    const client = getAnthropic();
    const response = await client.messages.create({
      model: GENERATION_MODEL,
      max_tokens: GENERATION_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText = stripCodeFences(
      response.content[0].type === "text" ? response.content[0].text : "",
    );

    let generated: {
      content_he: string;
      content_en: string;
      metadata: Record<string, unknown>;
    };

    try {
      generated = JSON.parse(rawText);
    } catch {
      generated = { content_he: rawText, content_en: rawText, metadata: {} };
    }

    // Persist to generated_content table
    const { data: saved, error: saveErr } = await db
      .from("generated_content")
      .insert({
        article_id,
        analysis_id: analysis?.id ?? null,
        content_type,
        body_he: generated.content_he,
        body_en: generated.content_en,
        body: generated.content_en,
        approval_status: "draft",
        model_used: GENERATION_MODEL,
      })
      .select()
      .single();

    if (saveErr) {
      console.error("Failed to save generated content:", saveErr);
      return errorResponse("Failed to save content", 500);
    }

    return jsonResponse({
      id: saved.id,
      content_type,
      content_he: generated.content_he,
      content_en: generated.content_en,
      metadata: generated.metadata,
    });
  } catch (err) {
    console.error("generate-content error:", err);
    return errorResponse(String(err));
  }
});
