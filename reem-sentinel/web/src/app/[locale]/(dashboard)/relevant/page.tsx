"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { useArticles, useSources } from "@/lib/hooks/use-data";
import type { Analysis } from "@/lib/supabase/types";
import { ArticleCard } from "@/components/article-card";

export default function RelevantPage() {
  const t = useTranslations("articles");
  const tCommon = useTranslations("common");
  const { data: articles, isLoading } = useArticles();
  const { data: sources } = useSources();

  const [search, setSearch] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  // Only show AI-analyzed articles (those with sentiment)
  const filtered = articles?.filter((article) => {
    const analysis: Analysis | undefined = article.analyses?.[0];

    // Must have AI analysis with sentiment
    if (!analysis?.sentiment) return false;

    if (search) {
      const q = search.toLowerCase();
      const titleMatch = article.title?.toLowerCase().includes(q);
      const contentMatch = article.content?.toLowerCase().includes(q);
      const summaryMatch =
        analysis?.summary_he?.toLowerCase().includes(q) ||
        analysis?.summary_en?.toLowerCase().includes(q);
      if (!titleMatch && !contentMatch && !summaryMatch) return false;
    }

    if (sentimentFilter !== "all" && analysis.sentiment !== sentimentFilter) {
      return false;
    }

    if (sourceFilter !== "all") {
      const src = article.source as { id: string } | undefined;
      if (src?.id !== sourceFilter) return false;
    }

    return true;
  }) ?? [];

  const sorted = [...filtered].sort((a, b) => {
    const dateA = new Date(a.published_at ?? a.created_at).getTime();
    const dateB = new Date(b.published_at ?? b.created_at).getTime();
    return sortBy === "oldest" ? dateA - dateB : dateB - dateA;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("relevantTitle")}</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={tCommon("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
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
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as "newest" | "oldest")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("sortBy")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t("sortNewest")}</SelectItem>
            <SelectItem value="oldest">{t("sortOldest")}</SelectItem>
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
          {sorted.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
