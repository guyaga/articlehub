/**
 * scan-trigger: Lightweight function called by pg_cron via pg_net.
 * Simply forwards the request to scan-orchestrator.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return errorResponse("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);
    }

    // Forward to scan-orchestrator
    const orchestratorUrl = `${supabaseUrl}/functions/v1/scan-orchestrator`;
    const response = await fetch(orchestratorUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trigger: "scheduled" }),
    });

    const result = await response.json();

    return jsonResponse({
      ok: response.ok,
      status: response.status,
      result,
    });
  } catch (err) {
    console.error("scan-trigger error:", err);
    return errorResponse(String(err));
  }
});
