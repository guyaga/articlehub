"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Plus, Pencil, Trash2, Info, Zap, Brain, Filter, BarChart3, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useSources,
  useKeywords,
  useArticles,
  useSystemConfig,
  useCreateKeyword,
  useUpdateKeyword,
  useDeleteKeyword,
  useCreateSource,
  useUpdateSource,
  useDeleteSource,
} from "@/lib/hooks/use-data";
import type { Keyword, Source, SourceType } from "@/lib/supabase/types";

// ── Settings Page ──────────────────────────────────────────────
export default function SettingsPage() {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>

      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">{t("sources")}</TabsTrigger>
          <TabsTrigger value="keywords">{t("keywords")}</TabsTrigger>
          <TabsTrigger value="schedule">{t("schedule")}</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-4">
          <SourcesTab />
        </TabsContent>
        <TabsContent value="keywords" className="mt-4">
          <KeywordsTab />
        </TabsContent>
        <TabsContent value="schedule" className="mt-4">
          <ScheduleTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Keywords Tab ───────────────────────────────────────────────
type KeywordFormData = {
  term_he: string;
  term_en: string;
  category: string;
  weight: string;
};

const emptyKeywordForm: KeywordFormData = { term_he: "", term_en: "", category: "", weight: "5" };

function weightPriority(w: number) {
  if (w >= 8) return { label: "CRITICAL", color: "bg-red-500", textColor: "text-red-400", bg: "bg-red-500/10 text-red-400" };
  if (w >= 5) return { label: "HIGH", color: "bg-amber-500", textColor: "text-amber-400", bg: "bg-amber-500/10 text-amber-400" };
  return { label: "NORMAL", color: "bg-slate-500", textColor: "text-slate-400", bg: "bg-slate-500/10 text-slate-400" };
}

function KeywordsTab() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const isRTL = locale === "he";
  const { data: keywords, isLoading } = useKeywords();
  const { data: articles } = useArticles();
  const createMutation = useCreateKeyword();
  const updateMutation = useUpdateKeyword();
  const deleteMutation = useDeleteKeyword();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<KeywordFormData>(emptyKeywordForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Compute per-keyword match stats from article analyses
  const keywordMatchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!articles) return counts;
    for (const article of articles) {
      const raw = article.analyses?.[0]?.matched_keywords;
      if (!raw) continue;
      try {
        const matched: string[] = typeof raw === "string" ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
        for (const kw of matched) {
          const normalized = kw.trim().toLowerCase();
          counts[normalized] = (counts[normalized] || 0) + 1;
        }
      } catch {
        // ignore parse errors
      }
    }
    return counts;
  }, [articles]);

  // Helper: find match count for a keyword (check both Hebrew and English terms)
  function getMatchCount(kw: Keyword): number {
    const heCount = keywordMatchCounts[kw.term_he.trim().toLowerCase()] ?? 0;
    const enCount = kw.term_en ? (keywordMatchCounts[kw.term_en.trim().toLowerCase()] ?? 0) : 0;
    return Math.max(heCount, enCount);
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const activeCount = keywords?.filter((k) => k.is_active).length ?? 0;

  function openAdd() {
    setEditingId(null);
    setForm(emptyKeywordForm);
    setFormOpen(true);
  }

  function openEdit(kw: Keyword) {
    setEditingId(kw.id);
    setForm({
      term_he: kw.term_he,
      term_en: kw.term_en ?? "",
      category: kw.category ?? "",
      weight: String(kw.weight),
    });
    setFormOpen(true);
  }

  function handleSave() {
    const weight = Math.min(10, Math.max(0, Number(form.weight) || 0));
    const payload = {
      term_he: form.term_he,
      term_en: form.term_en || null,
      category: form.category || null,
      weight,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload }, { onSuccess: () => setFormOpen(false) });
    } else {
      createMutation.mutate(payload, { onSuccess: () => setFormOpen(false) });
    }
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  }

  function toggleActive(kw: Keyword) {
    updateMutation.mutate({ id: kw.id, data: { is_active: !kw.is_active } });
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const formValid = form.term_he.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* How Scoring Works */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Info className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {t("scoringTitle")}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {t("scoringDesc")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex items-center gap-2.5 rounded-md border border-border/50 bg-background/50 px-3 py-2.5">
              <Filter className="h-4 w-4 text-blue-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold">{t("step1Title")}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t("step1Desc")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-md border border-border/50 bg-background/50 px-3 py-2.5">
              <Zap className="h-4 w-4 text-green-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold">{t("step2Title")}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t("step2Desc")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-md border border-border/50 bg-background/50 px-3 py-2.5">
              <Download className="h-4 w-4 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold">{t("step3Title")}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t("step3Desc")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-md border border-border/50 bg-background/50 px-3 py-2.5">
              <Brain className="h-4 w-4 text-purple-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold">{t("step4Title")}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t("step4Desc")}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {t("weightCritical")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {t("weightHigh")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              {t("weightNormal")}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Keywords Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("keywords")}</CardTitle>
            <CardDescription>
              {activeCount} {t("activeOf")} / {keywords?.length ?? 0} {tc("total")}
            </CardDescription>
          </div>
          <Button size="sm" onClick={openAdd} className="cursor-pointer">
            <Plus /> {t("addKeyword")}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("termHe")}</TableHead>
                <TableHead>{t("termEn")}</TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead>{t("weight")}</TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    {t("matches")}
                  </span>
                </TableHead>
                <TableHead>{t("active")}</TableHead>
                <TableHead className="w-24">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keywords?.map((kw) => {
                const priority = weightPriority(kw.weight);
                const matches = getMatchCount(kw);
                return (
                  <TableRow key={kw.id} className={!kw.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-medium" dir="rtl">{kw.term_he}</TableCell>
                    <TableCell>{kw.term_en ?? "—"}</TableCell>
                    <TableCell>
                      {kw.category ? (
                        <Badge variant="secondary" className="text-xs capitalize">
                          {kw.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${priority.color}`}
                            style={{ width: `${(kw.weight / 10) * 100}%` }}
                          />
                        </div>
                        <Badge className={`text-[10px] px-1.5 py-0 h-5 ${priority.bg}`}>
                          {priority.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {matches > 0 ? (
                        <span className="text-sm font-medium tabular-nums">{matches}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs cursor-pointer select-none ${kw.is_active ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}`}
                        onClick={() => toggleActive(kw)}
                      >
                        {kw.is_active ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => openEdit(kw)} className="cursor-pointer">
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => setDeleteId(kw.id)} className="cursor-pointer">
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t("editKeyword") : t("addKeyword")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">{t("termHe")} *</label>
              <Input dir="rtl" value={form.term_he} onChange={(e) => setForm({ ...form, term_he: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">{t("termEn")}</label>
              <Input value={form.term_en} onChange={(e) => setForm({ ...form, term_en: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">{t("category")}</label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                {t("weight")} (0-10)
                <span className="text-xs text-muted-foreground ms-2">
                  {(() => {
                    const w = Number(form.weight) || 0;
                    const p = weightPriority(w);
                    return `→ ${p.label}`;
                  })()}
                </span>
              </label>
              <Input type="number" min={0} max={10} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">
                {t("weightCritical").split(":")[0] + ", " + t("weightHigh").split(":")[0] + ", " + t("weightNormal").split(":")[0]}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleSave} disabled={!formValid || isSaving}>
              {isSaving ? tc("loading") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteKeyword")}</DialogTitle>
            <DialogDescription>{t("confirmDelete")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{tc("cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? tc("loading") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sources Tab ────────────────────────────────────────────────
type SourceFormData = {
  name: string;
  url: string;
  rss_url: string;
  source_type: SourceType;
  ingestion_method: "rss" | "firecrawl" | "manual";
};

const emptySourceForm: SourceFormData = {
  name: "",
  url: "",
  rss_url: "",
  source_type: "mainstream",
  ingestion_method: "rss",
};

const SOURCE_TYPES: SourceType[] = ["mainstream", "economic", "sectoral", "social_media", "other"];
const INGESTION_METHODS: SourceFormData["ingestion_method"][] = ["rss", "firecrawl", "manual"];

function SourcesTab() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { data: sources, isLoading } = useSources();
  const createMutation = useCreateSource();
  const updateMutation = useUpdateSource();
  const deleteMutation = useDeleteSource();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SourceFormData>(emptySourceForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  function openAdd() {
    setEditingId(null);
    setForm(emptySourceForm);
    setFormOpen(true);
  }

  function openEdit(src: Source) {
    setEditingId(src.id);
    setForm({
      name: src.name,
      url: src.url,
      rss_url: src.rss_url ?? "",
      source_type: src.source_type,
      ingestion_method: src.ingestion_method,
    });
    setFormOpen(true);
  }

  function handleSave() {
    const payload = {
      name: form.name,
      url: form.url,
      rss_url: form.rss_url || null,
      source_type: form.source_type,
      ingestion_method: form.ingestion_method,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload }, { onSuccess: () => setFormOpen(false) });
    } else {
      createMutation.mutate(payload, { onSuccess: () => setFormOpen(false) });
    }
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  }

  function toggleActive(src: Source) {
    updateMutation.mutate({ id: src.id, data: { is_active: !src.is_active } });
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const formValid = form.name.trim().length > 0 && form.url.trim().length > 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("sources")}</CardTitle>
            <CardDescription>{t("sourcesConfigured", { count: sources?.length ?? 0 })}</CardDescription>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus /> {t("addSource")}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("sourceType")}</TableHead>
                <TableHead>{t("ingestionMethod")}</TableHead>
                <TableHead>{t("active")}</TableHead>
                <TableHead>{t("failures")}</TableHead>
                <TableHead className="w-24">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources?.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      {source.name}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {source.source_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{source.ingestion_method}</TableCell>
                  <TableCell>
                    <Badge
                      className={`text-xs cursor-pointer select-none ${source.is_active ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}
                      onClick={() => toggleActive(source)}
                    >
                      {source.is_active ? t("active") : t("inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {source.failure_count}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-xs" onClick={() => openEdit(source)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={() => setDeleteId(source.id)}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t("editSource") : t("addSource")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">{t("name")} *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">{t("url")} *</label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">{t("rssUrl")}</label>
              <Input value={form.rss_url} onChange={(e) => setForm({ ...form, rss_url: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">{t("sourceType")}</label>
              <Select value={form.source_type} onValueChange={(v) => setForm({ ...form, source_type: v as SourceType })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((st) => (
                    <SelectItem key={st} value={st} className="capitalize">{st.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">{t("ingestionMethod")}</label>
              <Select value={form.ingestion_method} onValueChange={(v) => setForm({ ...form, ingestion_method: v as SourceFormData["ingestion_method"] })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INGESTION_METHODS.map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleSave} disabled={!formValid || isSaving}>
              {isSaving ? tc("loading") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteSource")}</DialogTitle>
            <DialogDescription>{t("confirmDelete")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{tc("cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? tc("loading") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Schedule Tab ───────────────────────────────────────────────
function ScheduleTab() {
  const t = useTranslations("settings");
  const { data: config, isLoading } = useSystemConfig();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("systemConfig")}</CardTitle>
        <CardDescription>{t("systemConfigDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("configKey")}</TableHead>
              <TableHead>{t("configValue")}</TableHead>
              <TableHead>{t("configDescription")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {config?.map((item) => (
              <TableRow key={item.key}>
                <TableCell className="font-mono text-sm font-medium">
                  {item.key}
                </TableCell>
                <TableCell>
                  <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                    {JSON.stringify(item.value)}
                  </code>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.description ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
