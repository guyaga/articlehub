"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Clock, AlertTriangle } from "lucide-react";

type Status = "done" | "in-progress" | "planned" | "blocked";

interface StatusItem {
  label: string;
  status: Status;
  detail?: string;
}

interface StatusSection {
  title: string;
  items: StatusItem[];
}

const PROJECT_STATUS: StatusSection[] = [
  {
    title: "Backend Pipeline",
    items: [
      { label: "RSS source scanning (13 sources)", status: "done" },
      { label: "Keyword matching (instant, no AI)", status: "done" },
      { label: "Firecrawl full-article fetch", status: "done" },
      { label: "Claude AI analysis (sentiment, summaries, entities)", status: "done" },
      { label: "pg_cron scheduled scans (morning + afternoon)", status: "done" },
      { label: "Staleness check (every 5 min)", status: "done" },
      { label: "Email briefs via Resend", status: "done" },
    ],
  },
  {
    title: "Frontend — Dashboard",
    items: [
      { label: "Pipeline status chart (replaces old scoring)", status: "done" },
      { label: "Opposing sentiment alert banner", status: "done" },
      { label: "Source health indicators", status: "done" },
      { label: "Scan history with status badges", status: "done" },
      { label: "Analyzed articles metric card", status: "done" },
    ],
  },
  {
    title: "Frontend — Articles",
    items: [
      { label: "Article list with pipeline tier badges", status: "done" },
      { label: "Matched keyword tags on article cards", status: "done" },
      { label: "Fetch Full Article button (per-article spinner + toast)", status: "done" },
      { label: "Pipeline status filter (Matched / Analyzed / Deep)", status: "done" },
      { label: "Sentiment filter", status: "done" },
      { label: "Source filter", status: "done" },
      { label: "Article detail — pipeline stepper with CTA", status: "done" },
      { label: "Article detail — sentiment + summaries + entities", status: "done" },
      { label: "Generated content panel", status: "done" },
    ],
  },
  {
    title: "Frontend — Settings",
    items: [
      { label: "4-step pipeline explanation (Scan → Match → Fetch → Analyze)", status: "done" },
      { label: "Keywords CRUD with match counts", status: "done" },
      { label: "Sources CRUD with health status", status: "done" },
      { label: "System config viewer", status: "done" },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      { label: "Supabase Edge Functions (7 functions)", status: "done" },
      { label: "Vercel frontend deployment", status: "done" },
      { label: "i18n — Hebrew + English", status: "done" },
      { label: "Dark/Light theme", status: "done" },
      { label: "Rebrand to ArticleHub", status: "done" },
    ],
  },
  {
    title: "Planned / Next",
    items: [
      { label: "Auth — user login / multi-tenant", status: "planned" },
      { label: "Notifications — in-app alerts", status: "planned" },
      { label: "Content calendar — schedule generated posts", status: "planned" },
      { label: "Analytics — trend tracking over time", status: "planned" },
      { label: "Knowledge base — document management", status: "planned" },
      { label: "Webhook integrations (Slack, Teams)", status: "planned" },
    ],
  },
];

const statusConfig: Record<Status, { icon: typeof CheckCircle2; color: string; badgeClass: string; label: string }> = {
  done: { icon: CheckCircle2, color: "text-green-500", badgeClass: "bg-green-500/15 text-green-400", label: "Done" },
  "in-progress": { icon: Clock, color: "text-blue-500", badgeClass: "bg-blue-500/15 text-blue-400", label: "In Progress" },
  planned: { icon: Circle, color: "text-slate-400", badgeClass: "bg-slate-500/15 text-slate-400", label: "Planned" },
  blocked: { icon: AlertTriangle, color: "text-amber-500", badgeClass: "bg-amber-500/15 text-amber-400", label: "Blocked" },
};

export default function StatusPage() {
  const t = useTranslations("status");

  const totals = PROJECT_STATUS.flatMap((s) => s.items);
  const doneCount = totals.filter((i) => i.status === "done").length;
  const inProgressCount = totals.filter((i) => i.status === "in-progress").length;
  const plannedCount = totals.filter((i) => i.status === "planned").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-3">
        <Badge className="bg-green-500/15 text-green-400 text-sm px-3 py-1">
          {doneCount} {t("done")}
        </Badge>
        {inProgressCount > 0 && (
          <Badge className="bg-blue-500/15 text-blue-400 text-sm px-3 py-1">
            {inProgressCount} {t("inProgress")}
          </Badge>
        )}
        <Badge className="bg-slate-500/15 text-slate-400 text-sm px-3 py-1">
          {plannedCount} {t("planned")}
        </Badge>
      </div>

      {/* Sections */}
      <div className="grid gap-4">
        {PROJECT_STATUS.map((section) => (
          <Card key={section.title}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {section.items.map((item) => {
                  const cfg = statusConfig[item.status];
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex items-start gap-3 py-1.5"
                    >
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">{item.label}</span>
                        {item.detail && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.detail}
                          </p>
                        )}
                      </div>
                      <Badge className={`text-[10px] shrink-0 ${cfg.badgeClass}`}>
                        {cfg.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
