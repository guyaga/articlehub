"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useKnowledgeBase, useCreateKnowledgeDoc, useDeleteKnowledgeDoc } from "@/lib/hooks/use-data";
import { formatDate } from "@/lib/format";

const DOC_TYPES = ["transcript", "article", "style_guide", "speech", "policy", "other"] as const;

type DocFormData = {
  title: string;
  doc_type: string;
  content: string;
  tags: string;
};

const emptyForm: DocFormData = { title: "", doc_type: "transcript", content: "", tags: "" };

export default function KnowledgePage() {
  const t = useTranslations("knowledge");
  const tc = useTranslations("common");
  const { data: docs, isLoading } = useKnowledgeBase();
  const createMutation = useCreateKnowledgeDoc();
  const deleteMutation = useDeleteKnowledgeDoc();

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<DocFormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleSave() {
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    createMutation.mutate(
      {
        title: form.title,
        doc_type: form.doc_type,
        content: form.content,
        tags,
        is_active: true,
      },
      {
        onSuccess: () => {
          setFormOpen(false);
          setForm(emptyForm);
        },
      }
    );
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  }

  const formValid = form.title.trim().length > 0 && form.content.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> {t("addDocument")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !docs?.length ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium mb-1">No documents yet</p>
              <p className="text-sm">
                Add transcripts, articles, or style guides to build the RAG knowledge base.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>{t("documentType")}</TableHead>
                  <TableHead>{t("tags")}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {doc.doc_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {doc.tags?.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs ${doc.is_active ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}`}
                      >
                        {doc.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(doc.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-xs" onClick={() => setDeleteId(doc.id)}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Document Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addDocument")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">{t("documentType")}</label>
              <Select
                value={form.doc_type}
                onValueChange={(v) => setForm({ ...form, doc_type: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((dt) => (
                    <SelectItem key={dt} value={dt} className="capitalize">
                      {dt.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Content *</label>
              <Textarea
                rows={6}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Paste transcript, article text, or style guide..."
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">{t("tags")}</label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="Comma-separated tags"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formValid || createMutation.isPending}
            >
              {createMutation.isPending ? tc("loading") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              This will permanently remove this document from the knowledge base.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? tc("loading") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
