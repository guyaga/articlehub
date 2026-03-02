"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Scan,
  Article,
  Analysis,
  Source,
  Keyword,
  GeneratedContent,
  KnowledgeBaseDoc,
  SystemConfig,
} from "@/lib/supabase/types";

export type ArticleDetail = Article & {
  analyses: Analysis[];
  source: Pick<Source, "id" | "name" | "source_type" | "url"> | null;
  generated_content: GeneratedContent[];
};

async function fetchData<T>(query: string, params?: Record<string, string>): Promise<T> {
  const url = new URL("/api/data", window.location.origin);
  url.searchParams.set("query", query);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API error ${res.status}`);
  }
  return res.json();
}

// ── Scans ──────────────────────────────────────────────────────
export function useScans() {
  return useQuery<Scan[]>({
    queryKey: ["scans"],
    queryFn: () => fetchData<Scan[]>("scans"),
  });
}

export function useLatestScan() {
  return useQuery<Scan | null>({
    queryKey: ["scans", "latest"],
    queryFn: () => fetchData<Scan | null>("latest_scan"),
  });
}

// ── Articles with analyses ─────────────────────────────────────
export function useArticles() {
  return useQuery<(Article & { analyses: Analysis[] })[]>({
    queryKey: ["articles"],
    queryFn: () => fetchData("articles"),
  });
}

// ── Single Article Detail ─────────────────────────────────────
export function useArticle(id: string | undefined) {
  return useQuery<ArticleDetail>({
    queryKey: ["article_detail", id],
    queryFn: () => fetchData<ArticleDetail>("article_detail", { id: id! }),
    enabled: !!id,
  });
}

// ── Drill Down (Deep Scrape) ──────────────────────────────────
export function useDrillDown() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (articleId: string) => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/article-drill-down`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ article_id: articleId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Drill-down failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (_data, articleId) => {
      qc.invalidateQueries({ queryKey: ["article_detail", articleId] });
      qc.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}

// ── Generate Content for Article ──────────────────────────────
export function useGenerateArticleContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ articleId, contentType }: { articleId: string; contentType: string }) => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-content`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ article_id: articleId, content_type: contentType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Content generation failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (_data, { articleId }) => {
      qc.invalidateQueries({ queryKey: ["article_detail", articleId] });
      qc.invalidateQueries({ queryKey: ["generated_content"] });
    },
  });
}

// ── Sources ────────────────────────────────────────────────────
export function useSources() {
  return useQuery<Source[]>({
    queryKey: ["sources"],
    queryFn: () => fetchData<Source[]>("sources"),
  });
}

// ── Keywords ───────────────────────────────────────────────────
export function useKeywords() {
  return useQuery<Keyword[]>({
    queryKey: ["keywords"],
    queryFn: () => fetchData<Keyword[]>("keywords"),
  });
}

// ── Generated Content ──────────────────────────────────────────
export function useGeneratedContent(status?: string) {
  return useQuery<GeneratedContent[]>({
    queryKey: ["generated_content", status],
    queryFn: () =>
      fetchData<GeneratedContent[]>("generated_content", {
        ...(status ? { status } : {}),
      }),
  });
}

// ── Knowledge Base ─────────────────────────────────────────────
export function useKnowledgeBase() {
  return useQuery<KnowledgeBaseDoc[]>({
    queryKey: ["knowledge_base"],
    queryFn: () => fetchData<KnowledgeBaseDoc[]>("knowledge_base"),
  });
}

export function useCreateKnowledgeDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<KnowledgeBaseDoc>) =>
      mutateData("POST", { table: "knowledge_base", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge_base"] }),
  });
}

export function useDeleteKnowledgeDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      mutateData("DELETE", { table: "knowledge_base", id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge_base"] }),
  });
}

// ── System Config ──────────────────────────────────────────────
export function useSystemConfig() {
  return useQuery<SystemConfig[]>({
    queryKey: ["system_config"],
    queryFn: () => fetchData<SystemConfig[]>("system_config"),
  });
}

// ── Dashboard Stats ────────────────────────────────────────────
export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard_stats"],
    queryFn: () =>
      fetchData<{
        totalArticles: number;
        relevantArticles: number;
        pendingContent: number;
        lastScan: Scan | null;
      }>("stats"),
  });
}

// ── Generic mutate helper ─────────────────────────────────────
async function mutateData(method: "POST" | "PUT" | "DELETE", body: unknown) {
  const res = await fetch("/api/data", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  return res.json();
}

// ── Keyword Mutations ─────────────────────────────────────────
export function useCreateKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Keyword>) =>
      mutateData("POST", { table: "keywords", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keywords"] }),
  });
}

export function useUpdateKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Keyword> }) =>
      mutateData("PUT", { table: "keywords", id, data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keywords"] }),
  });
}

export function useDeleteKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      mutateData("DELETE", { table: "keywords", id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keywords"] }),
  });
}

// ── Source Mutations ──────────────────────────────────────────
export function useCreateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Source>) =>
      mutateData("POST", { table: "sources", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources"] }),
  });
}

export function useUpdateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Source> }) =>
      mutateData("PUT", { table: "sources", id, data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources"] }),
  });
}

export function useDeleteSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      mutateData("DELETE", { table: "sources", id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources"] }),
  });
}

// ── Trigger Scan Mutation ──────────────────────────────────────
export function useTriggerScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/scan-orchestrator`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trigger: "manual" }),
      });
      if (!res.ok) throw new Error("Failed to trigger scan");
      return res.json();
    },
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["scans"] });
        qc.invalidateQueries({ queryKey: ["dashboard_stats"] });
      }, 2000);
    },
  });
}
