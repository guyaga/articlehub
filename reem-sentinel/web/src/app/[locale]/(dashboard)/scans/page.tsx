"use client";

import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useScans, useTriggerScan } from "@/lib/hooks/use-data";
import { formatDate, scanStatusColor } from "@/lib/format";

export default function ScansPage() {
  const t = useTranslations("scans");
  const locale = useLocale();
  const { data: scans, isLoading } = useScans();
  const triggerScan = useTriggerScan();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Button
          onClick={() => triggerScan.mutate()}
          disabled={triggerScan.isPending}
        >
          {triggerScan.isPending ? "Scanning..." : t("triggerScan")}
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
          ) : !scans?.length ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No scans yet. Click &quot;{t("triggerScan")}&quot; to run the first one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("sources")}</TableHead>
                  <TableHead>{t("articlesFound")}</TableHead>
                  <TableHead>Relevant</TableHead>
                  <TableHead>{t("startedAt")}</TableHead>
                  <TableHead>{t("completedAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell>
                      <Badge className={scanStatusColor(scan.status)}>
                        {scan.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-green-400">{scan.successful_sources}</span>
                      {scan.failed_sources > 0 && (
                        <span className="text-red-400"> / {scan.failed_sources} failed</span>
                      )}
                      <span className="text-muted-foreground"> / {scan.total_sources}</span>
                    </TableCell>
                    <TableCell>{scan.articles_found}</TableCell>
                    <TableCell>
                      <span className="font-medium">{scan.articles_relevant}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(scan.started_at, locale)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(scan.completed_at, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
