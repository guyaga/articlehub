"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/routing";
import { useDrillDown } from "@/lib/hooks/use-data";
import { formatDate, sentimentColor } from "@/lib/format";
import type { Analysis } from "@/lib/supabase/types";
import { Loader2, Download, CheckCircle2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SOURCE_FAVICONS } from "@/lib/constants";

interface ArticleCardProps {
  article: {
    id: string;
    title: string | null;
    url: string;
    content: string | null;
    published_at: string | null;
    created_at: string;
    is_drilled_down: boolean | null;
    analyses?: Analysis[];
    source?: { id: string; name: string; source_type: string } | null;
  };
}

export function ArticleCard({ article }: ArticleCardProps) {
  const t = useTranslations("articles");
  const tDetail = useTranslations("articleDetail");
  const locale = useLocale();
  const drillDown = useDrillDown();
  const [fetching, setFetching] = useState(false);

  const analysis: Analysis | undefined = article.analyses?.[0];
  const source = article.source as { name: string; source_type: string } | undefined;

  let matchedKeywords: string[] = [];
  try {
    const raw = analysis?.matched_keywords;
    if (typeof raw === "string") matchedKeywords = JSON.parse(raw);
    else if (Array.isArray(raw)) matchedKeywords = raw;
  } catch {}

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
    <Card className="overflow-hidden">
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

            {(() => {
              const summary = locale === "he" ? analysis?.summary_he : analysis?.summary_en;
              const snippet = summary || article.content;
              if (!snippet) return null;
              return (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2" dir="auto">
                  {snippet}
                </p>
              );
            })()}

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
                <Badge key={kw} className="text-xs bg-emerald-500/15 text-emerald-400 gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {kw}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              asChild
            >
              <Link href={`/articles/${article.id}`}>
                <Eye className="h-3.5 w-3.5" />
                {t("viewArticle")}
              </Link>
            </Button>
            {analysis?.sentiment && (
              <Badge className={`text-xs ${sentimentColor(analysis.sentiment)}`}>
                {analysis.sentiment}
              </Badge>
            )}
            {isDeep ? (
              <Badge className="text-xs bg-purple-500/15 text-purple-400 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {tDetail("tierDeep")}
              </Badge>
            ) : analysis && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={(e) => {
                  e.preventDefault();
                  setFetching(true);
                  drillDown.mutate(article.id, {
                    onSuccess: () => {
                      toast.success(tDetail("fetchFull"), {
                        description: article.title?.slice(0, 60),
                      });
                      setFetching(false);
                    },
                    onError: (err) => {
                      toast.error(err.message);
                      setFetching(false);
                    },
                  });
                }}
                disabled={fetching}
                title={tDetail("fetchFull")}
              >
                {fetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {fetching ? tDetail("fetching") : tDetail("fetchFull")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
