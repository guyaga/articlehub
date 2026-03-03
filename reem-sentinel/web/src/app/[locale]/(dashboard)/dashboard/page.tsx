"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Newspaper,
  Target,
  Radio,
  TrendingUp,
  ArrowUpRight,
  Zap,
  Activity,
  Loader2,
  Globe,
  Shield,
  ChevronRight,
  Wifi,
  WifiOff,
  Clock,
  BarChart3,
  PieChart as PieChartIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  useDashboardStats,
  useArticles,
  useScans,
  useSources,
  useTriggerScan,
} from "@/lib/hooks/use-data";
import { timeAgo, formatDate, sentimentColor } from "@/lib/format";
import type { Analysis } from "@/lib/supabase/types";

// ── Color System ──────────────────────────────────────────────
const CHART_COLORS = {
  blue: "#3b82f6",
  red: "#ef4444",
  amber: "#f59e0b",
  green: "#22c55e",
  slate: "#64748b",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  indigo: "#6366f1",
};

const SOURCE_PALETTE = [
  CHART_COLORS.blue,
  CHART_COLORS.cyan,
  CHART_COLORS.purple,
  CHART_COLORS.indigo,
  CHART_COLORS.amber,
  CHART_COLORS.green,
  CHART_COLORS.red,
  CHART_COLORS.slate,
];

import { SOURCE_FAVICONS } from "@/lib/constants";

function relevanceTier(score: number | null | undefined) {
  if (!score) return { label: "Unscored", bg: "bg-slate-500/10 text-slate-400" };
  if (score >= 0.7) return { label: "High", bg: "bg-red-500/10 text-red-400" };
  if (score >= 0.4) return { label: "Medium", bg: "bg-amber-500/10 text-amber-400" };
  return { label: "Low", bg: "bg-emerald-500/10 text-emerald-400" };
}

// ── Main Dashboard ────────────────────────────────────────────
export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const isRTL = locale === "he";
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: articles, isLoading: articlesLoading } = useArticles();
  const { data: scans } = useScans();
  const { data: sources } = useSources();
  const triggerScan = useTriggerScan();

  const lastScan = stats?.lastScan;

  // ── Computed analytics ───────────────────────────────────────
  const analytics = useMemo(() => {
    if (!articles?.length) return null;

    // Source distribution
    const srcMap: Record<string, number> = {};
    articles.forEach((a) => {
      const name = (a.source as { name: string } | undefined)?.name ?? "Unknown";
      srcMap[name] = (srcMap[name] || 0) + 1;
    });
    const sourceData = Object.entries(srcMap)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count], i) => ({
        name: name.length > 14 ? name.slice(0, 13) + "\u2026" : name,
        fullName: name,
        count,
        fill: SOURCE_PALETTE[i % SOURCE_PALETTE.length],
      }));

    // Relevance distribution
    let high = 0,
      medium = 0,
      low = 0,
      unscored = 0;
    articles.forEach((a) => {
      const s = a.analyses?.[0]?.relevance_score;
      if (s == null || s === 0) unscored++;
      else if (s >= 0.7) high++;
      else if (s >= 0.4) medium++;
      else low++;
    });
    const relevanceData = [
      { name: t("relevanceHigh"), value: high, fill: CHART_COLORS.red },
      { name: t("relevanceMedium"), value: medium, fill: CHART_COLORS.amber },
      { name: t("relevanceLow"), value: low, fill: CHART_COLORS.green },
      { name: t("relevanceUnscored"), value: unscored, fill: CHART_COLORS.slate },
    ].filter((d) => d.value > 0);

    // Sentiment distribution
    const sentMap: Record<string, number> = {};
    articles.forEach((a) => {
      const s = a.analyses?.[0]?.sentiment ?? "unknown";
      sentMap[s] = (sentMap[s] || 0) + 1;
    });

    return { sourceData, relevanceData, sentimentMap: sentMap, high, medium, low, unscored };
  }, [articles, isRTL]);

  // Source health
  const sourceHealth = useMemo(() => {
    if (!sources) return [];
    const articleSources = new Set(
      articles
        ?.map((a) => (a.source as { name: string } | undefined)?.name)
        .filter(Boolean) ?? [],
    );
    return sources.map((s) => ({
      ...s,
      hasArticles: articleSources.has(s.name),
    }));
  }, [sources, articles]);

  const recentArticles = useMemo(() => {
    if (!articles?.length) return [];
    return [...articles]
      .sort((a, b) => {
        const da = new Date(a.published_at ?? a.created_at).getTime();
        const db = new Date(b.published_at ?? b.created_at).getTime();
        return db - da;
      })
      .slice(0, 10);
  }, [articles]);
  const highRelevanceArticles =
    articles?.filter((a) => (a.analyses?.[0]?.relevance_score ?? 0) >= 0.7) ?? [];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 pb-8">
        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              {lastScan && (
                <>
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    {t("live")}
                  </span>
                  <Separator orientation="vertical" className="h-4" />
                  <span className="text-sm text-muted-foreground">
                    {t("lastScan")}: {timeAgo(lastScan.completed_at ?? lastScan.started_at, locale)}
                  </span>
                </>
              )}
            </div>
          </div>
          <Button
            onClick={() => triggerScan.mutate()}
            disabled={triggerScan.isPending}
            size="sm"
            className="gap-2 cursor-pointer shadow-sm"
          >
            {triggerScan.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {triggerScan.isPending ? t("scanning") : t("quickActions")}
          </Button>
        </div>

        {/* ── Stat Cards ────────────────────────────────────── */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 stagger-children">
          <MetricCard
            label={t("totalArticles")}
            value={stats?.totalArticles}
            loading={statsLoading}
            icon={<Newspaper className="h-5 w-5" />}
            accentColor="blue"
          />
          <MetricCard
            label={t("relevantArticles")}
            value={stats?.relevantArticles}
            loading={statsLoading}
            icon={<Target className="h-5 w-5" />}
            accentColor="red"
            badge={
              stats && stats.totalArticles > 0
                ? `${Math.round((stats.relevantArticles / stats.totalArticles) * 100)}%`
                : undefined
            }
          />
          <MetricCard
            label={t("activeSources")}
            value={sourceHealth.filter((s) => s.hasArticles).length}
            loading={!sources}
            icon={<Globe className="h-5 w-5" />}
            accentColor="cyan"
            badge={sources ? `/ ${sources.length}` : undefined}
          />
          <MetricCard
            label={t("lastScan")}
            loading={statsLoading}
            icon={<Radio className="h-5 w-5" />}
            accentColor="green"
            customValue={
              lastScan ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums">
                    {lastScan.articles_found}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {tCommon("found")}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">--</span>
              )
            }
          />
        </div>

        {/* ── Alert Banner ──────────────────────────────────── */}
        {highRelevanceArticles.length > 0 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-400">
                  {t("highRelevance", { count: highRelevanceArticles.length })}
                </p>
                <p className="text-xs text-red-400/60 mt-0.5 truncate" dir="auto">
                  {highRelevanceArticles[0]?.title}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-red-400 shrink-0" />
            </div>
          </div>
        )}

        {/* ── Main Grid ─────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Article Feed — 7 cols */}
          <Card className="lg:col-span-7 flex flex-col overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {t("recentArticles")}
              </CardTitle>
              {articles && (
                <Badge variant="secondary" className="text-xs tabular-nums font-normal">
                  {articles.length} {tCommon("total")}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {articlesLoading ? (
                <LoadingSkeleton />
              ) : recentArticles.length === 0 ? (
                <EmptyState t={t} />
              ) : (
                <ScrollArea className="h-[540px]">
                  <div className="divide-y divide-border/50">
                    {recentArticles.map((article) => (
                      <ArticleRow key={article.id} article={article} locale={locale} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Right Panel — 5 cols */}
          <div className="lg:col-span-5 space-y-5">
            {/* Source Distribution */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 border-b border-border/50">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {t("sourceDistribution")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 pb-3">
                {analytics?.sourceData && analytics.sourceData.length > 0 ? (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.sourceData}
                        layout="vertical"
                        margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={90}
                          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          content={({ payload }) => {
                            if (!payload?.[0]) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="rounded-md bg-popover border px-3 py-1.5 text-xs shadow-md">
                                <span className="font-medium">{d.fullName}</span>:{" "}
                                {d.count} {tCommon("articles")}
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                          {analytics.sourceData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} fillOpacity={0.8} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {tCommon("noData")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Relevance & Sentiment Row */}
            <div className="grid gap-4 grid-cols-2">
              {/* Relevance Donut */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-1 pt-4 px-4 border-b border-border/50">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <PieChartIcon className="h-3.5 w-3.5" />
                    {t("relevanceLabel")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-3">
                  {analytics?.relevanceData && analytics.relevanceData.length > 0 ? (
                    <div className="flex flex-col items-center">
                      <div className="h-28 w-28">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analytics.relevanceData}
                              cx="50%"
                              cy="50%"
                              innerRadius={28}
                              outerRadius={48}
                              paddingAngle={3}
                              dataKey="value"
                              strokeWidth={0}
                            >
                              {analytics.relevanceData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              content={({ payload }) => {
                                if (!payload?.[0]) return null;
                                const d = payload[0].payload;
                                return (
                                  <div className="rounded-md bg-popover border px-2.5 py-1 text-xs shadow-md">
                                    {d.name}: {d.value}
                                  </div>
                                );
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                        {analytics.relevanceData.map((d) => (
                          <span
                            key={d.name}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground"
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: d.fill }}
                            />
                            {d.name} ({d.value})
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">--</p>
                  )}
                </CardContent>
              </Card>

              {/* Sentiment Breakdown */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-1 pt-4 px-4 border-b border-border/50">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("sentimentLabel")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-3">
                  {analytics?.sentimentMap ? (
                    <div className="space-y-3">
                      {Object.entries(analytics.sentimentMap)
                        .sort(([, a], [, b]) => b - a)
                        .map(([sentiment, count]) => {
                          const total = articles?.length ?? 1;
                          const pct = Math.round((count / total) * 100);
                          return (
                            <div key={sentiment}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className={`h-2 w-2 rounded-full shrink-0 ${
                                      sentiment === "supportive"
                                        ? "bg-green-500"
                                        : sentiment === "opposing"
                                          ? "bg-red-500"
                                          : sentiment === "mixed"
                                            ? "bg-amber-500"
                                            : sentiment === "neutral"
                                              ? "bg-blue-500"
                                              : "bg-slate-400"
                                    }`}
                                  />
                                  <span className="text-xs capitalize">{sentiment}</span>
                                </span>
                                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                                  {count}
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    sentiment === "supportive"
                                      ? "bg-green-500"
                                      : sentiment === "opposing"
                                        ? "bg-red-500"
                                        : sentiment === "mixed"
                                          ? "bg-amber-500"
                                          : sentiment === "neutral"
                                            ? "bg-blue-500"
                                            : "bg-slate-400"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">--</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Source Health */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 border-b border-border/50">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {t("sourceHealth")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="grid grid-cols-2 gap-2">
                  {sourceHealth.map((s) => (
                    <Tooltip key={s.id}>
                      <TooltipTrigger asChild>
                        <div
                          className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs cursor-default transition-colors ${
                            s.hasArticles
                              ? "border-green-500/20 bg-green-500/5 hover:bg-green-500/10"
                              : "border-red-500/20 bg-red-500/5 opacity-60"
                          }`}
                        >
                          {s.hasArticles ? (
                            <Wifi className="h-3 w-3 text-green-500 shrink-0" />
                          ) : (
                            <WifiOff className="h-3 w-3 text-red-400 shrink-0" />
                          )}
                          <span className="truncate font-medium">{s.name}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">
                          {s.name} — {s.ingestion_method.toUpperCase()}
                          {!s.hasArticles && ` (${tCommon("noData")})`}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Scan History */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 border-b border-border/50">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t("scanHistory")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                {!scans?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("noScans")}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {scans.slice(0, 5).map((scan) => (
                      <div
                        key={scan.id}
                        className="flex items-center gap-3 rounded-md px-2.5 py-2 hover:bg-muted/40 transition-colors"
                      >
                        <ScanStatusIcon status={scan.status} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold tabular-nums">
                              {scan.articles_found}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {tCommon("articles")}
                            </span>
                            {scan.total_sources > 0 && (
                              <span className="text-xs text-muted-foreground">
                                &middot; {scan.successful_sources}/{scan.total_sources}{" "}
                                {tCommon("sources")}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground/60">
                            {timeAgo(scan.completed_at ?? scan.started_at, locale)}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 h-5 shrink-0 ${
                            scan.status === "completed"
                              ? "bg-green-500/10 text-green-400"
                              : scan.status === "running"
                                ? "bg-blue-500/10 text-blue-400"
                                : scan.status === "partial"
                                  ? "bg-amber-500/10 text-amber-400"
                                  : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {scan.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ── Metric Card ───────────────────────────────────────────────
const accentMap = {
  blue: {
    gradient: "from-blue-500/10 to-blue-500/5",
    icon: "text-blue-500",
    ring: "ring-blue-500/20",
  },
  red: {
    gradient: "from-red-500/10 to-red-500/5",
    icon: "text-red-500",
    ring: "ring-red-500/20",
  },
  cyan: {
    gradient: "from-cyan-500/10 to-cyan-500/5",
    icon: "text-cyan-500",
    ring: "ring-cyan-500/20",
  },
  green: {
    gradient: "from-green-500/10 to-green-500/5",
    icon: "text-green-500",
    ring: "ring-green-500/20",
  },
} as const;

function MetricCard({
  label,
  value,
  loading,
  icon,
  accentColor,
  badge,
  customValue,
}: {
  label: string;
  value?: number | null;
  loading: boolean;
  icon: React.ReactNode;
  accentColor: keyof typeof accentMap;
  badge?: string;
  customValue?: React.ReactNode;
}) {
  const accent = accentMap[accentColor];
  return (
    <Card className="overflow-hidden animate-fade-in-up">
      <CardContent className="p-4 relative">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${accent.gradient} pointer-events-none`}
        />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </span>
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center ${accent.icon} bg-background/50`}
            >
              {icon}
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : customValue ? (
            customValue
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums tracking-tight">
                {value ?? 0}
              </span>
              {badge && (
                <span className="text-sm text-muted-foreground font-medium">{badge}</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Scan Status Icon ──────────────────────────────────────────
function ScanStatusIcon({ status }: { status: string }) {
  if (status === "completed")
    return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (status === "running")
    return <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />;
  if (status === "partial")
    return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
  return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
}

// ── Article Row ───────────────────────────────────────────────
function ArticleRow({
  article,
  locale,
}: {
  article: {
    id: string;
    url: string;
    title: string | null;
    published_at: string | null;
    created_at: string;
    analyses?: Analysis[];
    source?: unknown;
  };
  locale: string;
}) {
  const analysis = article.analyses?.[0];
  const score = analysis?.relevance_score;
  const tier = relevanceTier(score);
  const source = article.source as { name: string; source_type: string } | undefined;
  const isRTL = locale === "he";
  const summary = isRTL ? analysis?.summary_he : analysis?.summary_en;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors cursor-pointer group"
    >
      {/* Score pill */}
      <div
        className={`h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${tier.bg}`}
      >
        {score ? Math.round(score * 100) : "\u2014"}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium leading-snug line-clamp-1 group-hover:underline decoration-muted-foreground/40 underline-offset-2"
          dir="auto"
        >
          {article.title || "Untitled"}
        </p>
        {summary && (
          <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1" dir="auto">
            {summary}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          {source && (
            <span className="inline-flex items-center gap-1">
              {SOURCE_FAVICONS[source.name] && (
                <img
                  src={SOURCE_FAVICONS[source.name]}
                  alt=""
                  className="h-3.5 w-3.5 rounded-sm object-contain"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-normal">
                {source.name}
              </Badge>
            </span>
          )}
          <span className="text-[11px] text-muted-foreground/60" title={formatDate(article.published_at ?? article.created_at, locale)}>
            {formatDate(article.published_at ?? article.created_at, locale)}
          </span>
        </div>
      </div>

      {/* Sentiment + arrow */}
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        {analysis?.sentiment && (
          <Badge
            variant="secondary"
            className={`text-[10px] px-1.5 py-0 h-5 ${sentimentColor(analysis.sentiment)}`}
          >
            {analysis.sentiment}
          </Badge>
        )}
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
      </div>
    </a>
  );
}

// ── Loading / Empty ───────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="divide-y divide-border/50">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-5 py-3.5">
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Newspaper className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium">
        {t("noArticles")}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {t("noArticlesHint")}
      </p>
    </div>
  );
}
