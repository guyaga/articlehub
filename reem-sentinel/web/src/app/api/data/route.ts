import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const WRITABLE_TABLES = ["keywords", "sources", "knowledge_base"] as const;
type WritableTable = (typeof WRITABLE_TABLES)[number];

const ALLOWED_QUERIES = [
  "scans",
  "latest_scan",
  "articles",
  "article_detail",
  "sources",
  "keywords",
  "generated_content",
  "knowledge_base",
  "system_config",
  "stats",
] as const;

type QueryName = (typeof ALLOWED_QUERIES)[number];

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query") as QueryName | null;
  const status = req.nextUrl.searchParams.get("status");
  const id = req.nextUrl.searchParams.get("id");

  if (!query || !ALLOWED_QUERIES.includes(query)) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    const data = await runQuery(supabase, query, { status, id });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST – insert row ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { table, data } = await req.json();
    if (!table || !WRITABLE_TABLES.includes(table as WritableTable)) {
      return NextResponse.json({ error: "Invalid table" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { data: row, error } = await supabase
      .from(table as WritableTable)
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(row, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PUT – update row ───────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const { table, id, data } = await req.json();
    if (!table || !WRITABLE_TABLES.includes(table as WritableTable) || !id) {
      return NextResponse.json({ error: "Invalid table or id" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { data: row, error } = await supabase
      .from(table as WritableTable)
      .update(data)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(row);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE – delete row ────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { table, id } = await req.json();
    if (!table || !WRITABLE_TABLES.includes(table as WritableTable) || !id) {
      return NextResponse.json({ error: "Invalid table or id" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { error } = await supabase
      .from(table as WritableTable)
      .delete()
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runQuery(
  supabase: ReturnType<typeof createServiceClient>,
  query: QueryName,
  params: { status?: string | null; id?: string | null }
) {
  switch (query) {
    case "scans": {
      const { data, error } = await supabase
        .from("scans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    }

    case "latest_scan": {
      const { data, error } = await supabase
        .from("scans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data ?? null;
    }

    case "articles": {
      const { data, error } = await supabase
        .from("articles")
        .select("*, analyses(*), source:sources(id, name, source_type)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    }

    case "article_detail": {
      if (!params.id) throw new Error("Missing id parameter");
      const { data, error } = await supabase
        .from("articles")
        .select("*, analyses(*), source:sources(id, name, source_type, url), generated_content(*)")
        .eq("id", params.id)
        .single();
      if (error) throw error;
      return data;
    }

    case "sources": {
      const { data, error } = await supabase
        .from("sources")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    }

    case "keywords": {
      const { data, error } = await supabase
        .from("keywords")
        .select("*")
        .order("weight", { ascending: false });
      if (error) throw error;
      return data ?? [];
    }

    case "generated_content": {
      let q = supabase
        .from("generated_content")
        .select("*")
        .order("created_at", { ascending: false });
      if (params.status && params.status !== "all") {
        q = q.eq("approval_status", params.status);
      }
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return data ?? [];
    }

    case "knowledge_base": {
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    }

    case "system_config": {
      const { data, error } = await supabase.from("system_config").select("*");
      if (error) throw error;
      return data ?? [];
    }

    case "stats": {
      const [articlesRes, scansRes, contentRes, relevantRes] =
        await Promise.all([
          supabase.from("articles").select("id", { count: "exact", head: true }),
          supabase
            .from("scans")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from("generated_content")
            .select("id", { count: "exact", head: true })
            .eq("approval_status", "pending_review"),
          supabase
            .from("analyses")
            .select("id", { count: "exact", head: true })
            .not("sentiment", "is", null),
        ]);

      return {
        totalArticles: articlesRes.count ?? 0,
        relevantArticles: relevantRes.count ?? 0,
        pendingContent: contentRes.count ?? 0,
        lastScan: scansRes.data ?? null,
      };
    }
  }
}
