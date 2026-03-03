"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/routing";
import { useArticles, useSources } from "@/lib/hooks/use-data";
import { timeAgo, formatDate, relevanceColor, sentimentColor } from "@/lib/format";
import type { Analysis } from "@/lib/supabase/types";

import { SOURCE_FAVICONS } from "@/lib/constants";

export default function ArticlesPage() {
  const t = useTranslations("articles");
  const tDetail = useTranslations("articleDetail");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { data: articles, isLoading } = useArticles();
  const { data: sources } = useSources();

  const [search, setSearch] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [relevanceFilter, setRelevanceFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "relevance">("newest");

  const filtered = articles?.filter((article) => {
    const analysis: Analysis | undefined = article.analyses?.[0];

    // Text search
    if (search) {
      const q = search.toLowerCase();
      const titleMatch = article.title?.toLowerCase().includes(q);
      const summaryMatch =
        analysis?.summary_he?.toLowerCase().includes(q) ||
        analysis?.summary_en?.toLowerCase().includes(q);
      if (!titleMatch && !summaryMatch) return false;
    }

    // Sentiment filter
    if (sentimentFilter !== "all" && analysis?.sentiment !== sentimentFilter) {
      return false;
    }

    // Relevance filter
    if (relevanceFilter !== "all") {
      const score = analysis?.relevance_score ?? 0;
      if (relevanceFilter === "high" && score < 0.7) return false;
      if (relevanceFilter === "medium" && (score < 0.4 || score >= 0.7)) return false;
      if (relevanceFilter === "low" && score >= 0.4) return false;
    }

    // Source filter
    if (sourceFilter !== "all") {
      const src = article.source as { id: string } | undefined;
      if (src?.id !== sourceFilter) return false;
    }

    return true;
  }) ?? [];

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "relevance") {
      const scoreA = (a.analyses?.[0] as Analysis | undefined)?.relevance_score ?? 0;
      const scoreB = (b.analyses?.[0] as Analysis | undefined)?.relevance_score ?? 0;
      return scoreB - scoreA;
    }
    const dateA = new Date(a.published_at ?? a.created_at).getTime();
    const dateB = new Date(b.published_at ?? b.created_at).getTime();
    return sortBy === "oldest" ? dateA - dateB : dateB - dateA;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={tCommon("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={relevanceFilter} onValueChange={setRelevanceFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("relevance")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allRelevance")}</SelectItem>
            <SelectItem value="high">{t("high")}</SelectItem>
            <SelectItem value="medium">{t("medium")}</SelectItem>
            <SelectItem value="low">{t("low")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("sentiment")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSentiment")}</SelectItem>
            <SelectItem value="supportive">{t("supportive")}</SelectItem>
            <SelectItem value="opposing">{t("opposing")}</SelectItem>
            <SelectItem value="neutral">{t("neutral")}</SelectItem>
            <SelectItem value="mixed">{t("mixed")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t("source")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSources")}</SelectItem>
            {sources?.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as "newest" | "oldest" | "relevance")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("sortBy")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t("sortNewest")}</SelectItem>
            <SelectItem value="oldest">{t("sortOldest")}</SelectItem>
            <SelectItem value="relevance">{t("sortRelevance")}</SelectItem>
          </SelectContent>
        </Select>
        <span className="self-center text-sm text-muted-foreground">
          {sorted.length} {tCommon("articles")}
        </span>
      </div>

      {/* Article List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tCommon("noResults")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((article) => {
            const analysis: Analysis | undefined = article.analyses?.[0];
            const source = article.source as { name: string; source_type: string } | undefined;
            let matchedKeywords: string[] = [];
            try {
              const raw = analysis?.matched_keywords;
              if (typeof raw === "string") matchedKeywords = JSON.parse(raw);
              else if (Array.isArray(raw)) matchedKeywords = raw;
            } catch {}

            // Determine pipeline tier
            const isDeep = article.is_drilled_down === true;
            const isAnalyzed = !!analysis?.sentiment;
            const tierLabel = isDeep
              ? tDetail("tierDeep")
              : isAnalyzed
                ? tDetail("tierAnalyzed")
                : tDetail("tierBasic");
            const tierColor = isDeep
              ? "bg-purple-500/15 text-purple-400"
              : isAnalyzed
                ? "bg-blue-500/15 text-blue-400"
                : "bg-slate-500/15 text-slate-400";

            return (
              <Card key={article.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/articles/${article.id}`}
                          className="font-semibold hover:underline line-clamp-2 text-base"
                          dir="auto"
                        >
                          {article.title || "Untitled"}
                        </Link>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          title={t("fullArticle")}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      </div>

                      {/* Summary */}
                      {locale === "he" && analysis?.summary_he && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3" dir="rtl">
                          {analysis.summary_he}
                        </p>
                      )}
                      {locale === "en" && analysis?.summary_en && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                          {analysis.summary_en}
                        </p>
                      )}

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge className={`text-xs ${tierColor}`}>
                          {tierLabel}
                        </Badge>
                        {source && (
                          <span className="inline-flex items-center gap-1">
                            {SOURCE_FAVICONS[source.name] && (
                              <img
                                src={SOURCE_FAVICONS[source.name]}
                                alt=""
                                className="h-4 w-4 rounded-sm object-contain"
                                loading="lazy"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            )}
                            <Badge variant="outline" className="text-xs">
                              {source.name}
                            </Badge>
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(article.published_at ?? article.created_at, locale)}
                        </span>
                        {matchedKeywords.map((kw) => (
                          <Badge key={kw} variant="secondary" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Scores */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {analysis && (
                        <>
                          <Badge className={`text-xs font-mono ${relevanceColor(analysis.relevance_score)}`}>
                            {analysis.relevance_score
                              ? `${Math.round(analysis.relevance_score * 100)}%`
                              : "—"}
                          </Badge>
                          <Badge className={`text-xs ${sentimentColor(analysis.sentiment)}`}>
                            {analysis.sentiment ?? "—"}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
