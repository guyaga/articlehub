/** Anthropic (Claude) API client wrapper. */

import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (_client) return _client;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  _client = new Anthropic({ apiKey });
  return _client;
}

/** Strip markdown code fences from a model response. */
export function stripCodeFences(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.split("\n", 2).length > 1
      ? text.split("\n").slice(1).join("\n")
      : text.slice(3);
    if (text.endsWith("```")) {
      text = text.slice(0, -3);
    }
    text = text.trim();
  }
  return text;
}
