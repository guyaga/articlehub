"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGeneratedContent } from "@/lib/hooks/use-data";
import { formatDate } from "@/lib/format";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-amber-500/15 text-amber-400",
  approved: "bg-green-500/15 text-green-400",
  rejected: "bg-red-500/15 text-red-400",
  published: "bg-blue-500/15 text-blue-400",
  archived: "bg-muted text-muted-foreground",
};

export default function ContentPage() {
  const t = useTranslations("content");
  const [tab, setTab] = useState("all");
  const { data: content, isLoading } = useGeneratedContent(tab);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending_review">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : !content?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No generated content yet. Content will appear here after articles are analyzed.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {content.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{item.title || item.content_type}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-3" dir="auto">
                          {item.body}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {item.content_type.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            v{item.revision}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(item.created_at)}
                          </span>
                        </div>
                      </div>
                      <Badge className={`text-xs ${statusColors[item.approval_status] ?? ""}`}>
                        {item.approval_status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
