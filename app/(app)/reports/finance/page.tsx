import { format, subMonths } from "date-fns";
import { Download, HandCoins, CalendarDays, CalendarRange, TrendingUp, Wallet } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { ReportFilters, parseReportFilters, toQuery } from "@/features/reports/filters";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { ChartCard } from "@/components/charts/chart-card";
import { GroupedBars, HBarList } from "@/components/charts/charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMoney, percentChange, titleCase, todayIn, toDate } from "@/lib/format";

export const metadata = { title: "Finance reports" };

type Summary = { currency: string; today: number; week: number; month: number; prev_month: number; year: number; count_month: number };

export default async function FinanceReportsPage({ searchParams }: PageProps<"/reports/finance">) {
  const ctx = await requireChurch("reports.finance", "giving.view");
  const sp = await searchParams;
  const today = todayIn(ctx.church.timezone);
  const f = parseReportFilters(sp, { from: format(subMonths(toDate(today)!, 5), "yyyy-MM-01"), to: today });
  const supabase = await createClient();
  const church = ctx.church.id;
  const [summary, trend, byCategory, byMethod] = await Promise.all([
    supabase.rpc("report_giving_summary", { p_church: church }),
    supabase.rpc("report_giving_trend", { p_church: church, p_from: f.from, p_to: f.to, p_bucket: f.bucket }),
    supabase.rpc("report_giving_breakdown", { p_church: church, p_from: f.from, p_to: f.to, p_by: "category" }),
    supabase.rpc("report_giving_breakdown", { p_church: church, p_from: f.from, p_to: f.to, p_by: "method" }),
  ]);
  const s = (summary.data ?? {}) as Partial<Summary>;
  const currency = s.currency ?? ctx.church.currency;
  const money = { kind: "money" as const, currency };
  const trendData = (trend.data ?? []).map((r) => ({ label: r.period ? formatDate(r.period, f.bucket === "week" ? "d MMM" : "MMM yy") : "", total: Number(r.total ?? 0), contributions: Number(r.contributions ?? 0) }));
  const periodTotal = trendData.reduce((a, b) => a + b.total, 0);
  const q = toQuery({ from: f.from, to: f.to });
  const canExport = ctx.can("data.export", "reports.finance");

  return (
    <>
      <PageHeader title="Finance reports" crumbs={[{ label: "Finance" }, { label: "Reports" }]} description={`Currency: ${currency}`} />
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Giving summary">
        <StatCard label="Giving today" value={formatMoney(s.today, currency, true)} icon={HandCoins} />
        <StatCard label="This week" value={formatMoney(s.week, currency, true)} icon={CalendarDays} tone="teal" />
        <StatCard
          label="This month"
          value={formatMoney(s.month, currency, true)}
          caption="vs last month"
          trend={percentChange(Number(s.month ?? 0), Number(s.prev_month ?? 0))}
          icon={CalendarRange}
          tone="green"
        />
        <StatCard label="Year to date" value={formatMoney(s.year, currency, true)} icon={Wallet} />
      </section>
      <ReportFilters values={f} action="/reports/finance" showPeopleFilters={false} />
      <ChartCard
        title="Giving trend"
        description={`Total for period: ${formatMoney(periodTotal, currency)}`}
        icon={<TrendingUp className="size-4 text-primary" aria-hidden />}
        data={trendData}
        series={[
          { key: "total", label: "Total" },
          { key: "contributions", label: "Number of gifts" },
        ]}
        format={money}
        action={
          canExport ? (
            <Button asChild variant="outline" size="sm">
              <a download href={`/api/export/giving-trend?${q}`}>
                <Download /> CSV
              </a>
            </Button>
          ) : undefined
        }
      >
        <GroupedBars data={trendData} series={[{ key: "total", label: "Total" }]} format={money} height={280} />
      </ChartCard>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {[
          { title: "By category", data: byCategory.data, by: "category" },
          { title: "By payment method", data: byMethod.data, by: "method" },
        ].map((b) => (
          <Card key={b.by}>
            <CardHeader>
              <CardTitle>{b.title}</CardTitle>
              {canExport && (
                <Button asChild variant="outline" size="sm">
                  <a download href={`/api/export/giving-breakdown?${q}&by=${b.by}`}>
                    <Download /> CSV
                  </a>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {(b.data ?? []).length === 0 ? (
                <EmptyState title="No giving in this period" className="py-8" />
              ) : (
                <HBarList
                  format={money}
                  items={b.data!.map((r) => ({
                    label: b.by === "method" ? (r.label === "pos" ? "POS" : titleCase(r.label)) : (r.label ?? ""),
                    value: Number(r.total ?? 0),
                    detail: `${r.contributions} gift${Number(r.contributions) === 1 ? "" : "s"}`,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Online payments (Paystack, Flutterwave, Stripe) are not connected yet; all figures are manually recorded contributions.
      </p>
    </>
  );
}
