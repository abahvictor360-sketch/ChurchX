"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { fmt, type ValueFormat } from "@/components/charts/format";
import type { Series } from "@/components/charts/chart-card";

const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)"];
const axis = { stroke: "var(--color-muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

function ChartTooltip({ active, payload, label, format }: TooltipContentProps & { format?: ValueFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {p.name}: <span className="font-semibold text-foreground tabular-nums">{fmt(Number(p.value ?? 0), format)}</span>
        </p>
      ))}
    </div>
  );
}

/** Single-series change over time: area with crosshair tooltip. */
export function TrendArea({
  data,
  series,
  format,
  height = 260,
}: {
  data: Record<string, string | number>[];
  series: Series;
  format?: ValueFormat;
  height?: number;
}) {
  return (
    <div style={{ height }} role="img" aria-label={`${series.label} trend chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`fill-${series.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" {...axis} minTickGap={16} />
          <YAxis {...axis} width={format?.kind === "money" ? 72 : 48} allowDecimals={false} tickFormatter={(v: number) => fmt(v, format, true)} />
          <Tooltip content={(p) => <ChartTooltip {...p} format={format} />} cursor={{ stroke: "var(--color-muted-foreground)", strokeDasharray: "3 3" }} />
          <Area
            type="monotone"
            dataKey={series.key}
            name={series.label}
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            fill={`url(#fill-${series.key})`}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-card)" }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bars for one or two series (grouped). Two series get a legend. */
export function GroupedBars({
  data,
  series,
  format,
  height = 260,
}: {
  data: Record<string, string | number>[];
  series: Series[];
  format?: ValueFormat;
  height?: number;
}) {
  return (
    <div style={{ height }} role="img" aria-label={`${series.map((s) => s.label).join(" and ")} chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" {...axis} minTickGap={8} />
          <YAxis {...axis} width={format?.kind === "money" ? 72 : 48} allowDecimals={false} tickFormatter={(v: number) => fmt(v, format, true)} />
          <Tooltip content={(p) => <ChartTooltip {...p} format={format} />} cursor={{ fill: "var(--color-muted)" }} />
          {series.length > 1 && (
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              height={28}
              formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>}
            />
          )}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLORS[i]} radius={[4, 4, 0, 0]} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ranked magnitudes with direct labels (no hover needed — values are printed). */
export function HBarList({ items, format }: { items: { label: string; value: number; detail?: string }[]; format?: ValueFormat }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="grid gap-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium">{i.label}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {fmt(i.value, format)}
              {i.detail && <span className="ml-1 text-xs">· {i.detail}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
