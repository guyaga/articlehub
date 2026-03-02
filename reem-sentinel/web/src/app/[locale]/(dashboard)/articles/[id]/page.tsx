"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  useArticle,
  useDrillDown,
  useGenerateArticleContent,
} from "@/lib/hooks/use-data";
import { formatDate, relevanceColor, sentimentColor } from "@/lib/format";
import type { Analysis, GeneratedContent } from "@/lib/supabase/types";

const CONTENT_TYPES = [
  "social_post",
  "press_response",
  "talking_points",
  "internal_brief",
  "response_draft",
] as const;

const SOURCE_FAVICONS: Record<string, string> = {
  "Ynet": "https://www.ynet.co.il/favicon.ico",
  "Haaretz": "https://www.haaretz.co.il/favicon.ico",
  "Walla": "https://www.walla.co.il/favicon.ico",
  "Globes": "https://www.globes.co.il/favicon.ico",
  "N12": "https://www.n12.co.il/favicon.ico",
  "Calcalist": "https://www.calcalist.co.il/favicon.ico",
  "Israel Hayom": "https://www.israelhayom.co.il/favicon.ico",
  "Maariv": "https://www.maariv.co.il/favicon.ico",
  "Arutz 7": "https://www.inn.co.il/favicon.ico",
  "Kikar HaShabbat": "https://www.kikar.co.il/favicon.ico",
  "Bizportal": "https://www.bizportal.co.il/favicon.ico",
};

export default function ArticleDetailPage() {
  const params = useParams();
  const articleId = params.id as string;
  const t = useTranslations("articleDetail");
  const locale = useLocale();

  const { data: article, isLoading } = useArticle(articleId);
  const drillDown = useDrillDown();
  const generateContent = useGenerateArticleContent();

  const [contentExpanded, setContentExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="space-y-4">
        <Link href="/articles">
          <Button variant="ghost" size="sm">
            &larr; {t("backToArticles")}
          </Button>
        </Link>
        <p className="text-muted-foreground">Article not found.</p>
      </div>
    );
  }

  const analysis: Analysis | undefined = article.analyses?.[0];
  const generatedContent: GeneratedContent[] = article.generated_content ?? [];
  const source = article.source;

  // Pipeline steps
  const isScraped = true;
  const isAnalyzed = !!analysis?.sentiment;
  const isDeepScraped = article.is_drilled_down === true;

  // Parse entities and keywords
  let matchedKeywords: string[] = [];
  let entities: Array<{ type: string; name: string }> = [];
  try {
    const rawKw = analysis?.matched_keywords;
    if (typeof rawKw === "string") matchedKeywords = JSON.parse(rawKw);
    else if (Array.isArray(rawKw)) matchedKeywords = rawKw;
  } catch {}
  try {
    const rawEnt = analysis?.entities;
    if (typeof rawEnt === "string") entities = JSON.parse(rawEnt);
    else if (Array.isArray(rawEnt)) entities = rawEnt;
  } catch {}

  const relevancePercent = analysis?.relevance_score
    ? Math.round(analysis.relevance_score * 100)
    : null;

  const contentPreview = article.content ?? "";
  const shouldTruncate = contentPreview.length > 500;
  const displayContent =
    contentExpanded || !shouldTruncate
      ? contentPreview
      : contentPreview.slice(0, 500) + "...";

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link href="/articles">
          <Button variant="ghost" size="sm">
            &larr; {t("backToArticles")}
          </Button>
        </Link>
        <a href={article.url} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            {t("openOriginal")} &nearr;
          </Button>
        </a>
      </div>

      {/* Pipeline Stepper */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-0">
            <PipelineStep label={t("stepScraped")} done={isScraped} />
            <StepConnector done={isAnalyzed} />
            <PipelineStep label={t("stepAnalyzed")} done={isAnalyzed} />
            <StepConnector done={isDeepScraped} />
            <PipelineStep label={t("stepDeepScraped")} done={isDeepScraped} />
          </div>
        </CardContent>
      </Card>

      {/* Title & Meta */}
      <div>
        <h1 className="text-2xl font-bold" dir="auto">
          {article.title || "Untitled"}
        </h1>
        <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
          {source && (
            <span className="inline-flex items-center gap-1">
              {SOURCE_FAVICONS[source.name] && (
                <img
                  src={SOURCE_FAVICONS[source.name]}
                  alt=""
                  className="h-4 w-4 rounded-sm object-contain"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <span className="font-medium">{source.name}</span>
            </span>
          )}
          <span>{formatDate(article.published_at ?? article.created_at, locale)}</span>
          {article.author && <span>{article.author}</span>}
        </div>
      </div>

      {/* Below-threshold notice */}
      {!isAnalyzed && relevancePercent !== null && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-3 text-sm text-amber-400">
            {t("belowThreshold", { score: String(relevancePercent) })}
          </CardContent>
        </Card>
      )}

      {/* Analysis Panel */}
      {isAnalyzed && analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("analysis")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Relevance + Sentiment row */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("relevance")}:</span>
                <Badge className={`font-mono ${relevanceColor(analysis.relevance_score)}`}>
                  {relevancePercent !== null ? `${relevancePercent}%` : "—"}
                </Badge>
                {relevancePercent !== null && (
                  <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${relevancePercent}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("sentiment")}:</span>
                <Badge className={sentimentColor(analysis.sentiment)}>
                  {analysis.sentiment ?? "—"}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Summary tabs */}
            {(analysis.summary_he || analysis.summary_en) && (
              <Tabs defaultValue={locale === "he" ? "he" : "en"}>
                <TabsList>
                  <TabsTrigger value="he">{t("summaryHe")}</TabsTrigger>
                  <TabsTrigger value="en">{t("summaryEn")}</TabsTrigger>
                </TabsList>
                <TabsContent value="he">
                  <p className="text-sm mt-2 leading-relaxed" dir="rtl">
                    {analysis.summary_he || "—"}
                  </p>
                </TabsContent>
                <TabsContent value="en">
                  <p className="text-sm mt-2 leading-relaxed">
                    {analysis.summary_en || "—"}
                  </p>
                </TabsContent>
              </Tabs>
            )}

            {/* Matched Keywords */}
            {matchedKeywords.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">{t("matchedKeywords")}:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {matchedKeywords.map((kw) => (
                    <Badge key={kw} variant="secondary">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Entities */}
            {entities.length > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">{t("entities")}:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {entities.map((ent, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {ent.type}: {ent.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Article Content */}
      {contentPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("articleContent")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-sm whitespace-pre-wrap leading-relaxed"
              dir="auto"
            >
              {displayContent}
            </div>
            {shouldTruncate && (
              <Button
                variant="link"
                size="sm"
                className="mt-2 p-0"
                onClick={() => setContentExpanded(!contentExpanded)}
              >
                {contentExpanded ? t("showLess") : t("showMore")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => drillDown.mutate(articleId)}
          disabled={drillDown.isPending || isDeepScraped}
        >
          {drillDown.isPending ? t("deepScraping") : t("deepScrape")}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={generateContent.isPending}>
              {generateContent.isPending ? t("generating") : t("generateContent")}
              {" \u25BE"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {CONTENT_TYPES.map((ct) => (
              <DropdownMenuItem
                key={ct}
                onClick={() =>
                  generateContent.mutate({
                    articleId,
                    contentType: ct,
                  })
                }
              >
                {t(`contentTypes.${ct}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Generated Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("generatedContent")}</CardTitle>
        </CardHeader>
        <CardContent>
          {generatedContent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noGeneratedContent")}
            </p>
          ) : (
            <div className="space-y-3">
              {generatedContent.map((gc) => (
                <div
                  key={gc.id}
                  className="rounded-md border p-3 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {gc.content_type?.replace(/_/g, " ")}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="text-xs"
                      >
                        {gc.approval_status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(gc.created_at, locale)}
                    </span>
                  </div>
                  <p className="text-sm line-clamp-3" dir="auto">
                    {(locale === "he" ? gc.body_he : gc.body_en) || gc.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Small subcomponents ─────────────────────────────────────── */

function PipelineStep({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
          done
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? "\u2713" : "\u25CB"}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function StepConnector({ done }: { done: boolean }) {
  return (
    <div
      className={`w-16 h-0.5 mx-1 transition-colors ${
        done ? "bg-primary" : "bg-muted"
      }`}
    />
  );
}
