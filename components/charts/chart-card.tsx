"use client";

import * as React from "react";
import { BarChart3, Table2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/app/empty-state";
import { fmt, type ValueFormat } from "@/components/charts/format";

export type Series = { key: string; label: string };

/** Card wrapper with a chart ⇄ table toggle (accessible alternative to every chart). */
export function ChartCard({
  title,
  description,
  icon,
  data,
  series,
  xKey = "label",
  format,
  emptyText = "No data yet for this period.",
  action,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  data: Record<string, string | number>[];
  series: Series[];
  xKey?: string;
  format?: ValueFormat;
  emptyText?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [asTable, setAsTable] = React.useState(false);
  const isEmpty = data.length === 0 || data.every((d) => series.every((s) => !Number(d[s.key])));
  return (
    <Card className="h-full">
      <CardHeader className="items-center">
        <div className="min-w-0">
          <CardTitle>
            {icon}
            {title}
          </CardTitle>
          {description && <CardDescription className="mt-1 text-xs">{description}</CardDescription>}
        </div>
        <div className="flex items-center gap-1">
          {action}
          {!isEmpty && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setAsTable((t) => !t)}
              aria-label={asTable ? "Show chart" : "Show as table"}
              aria-pressed={asTable}
              title={asTable ? "Show chart" : "Show as table"}
            >
              {asTable ? <BarChart3 /> : <Table2 />}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-3">
        {isEmpty ? (
          <EmptyState title="Nothing to show yet" description={emptyText} className="py-10" />
        ) : asTable ? (
          <div className="max-h-72 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  {series.map((s) => (
                    <TableHead key={s.key} className="text-right">
                      {s.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>{d[xKey]}</TableCell>
                    {series.map((s) => (
                      <TableCell key={s.key} className="text-right tabular-nums">
                        {fmt(Number(d[s.key] ?? 0), format)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
