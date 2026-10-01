import { format, subMonths } from "date-fns";
import { Download, PhoneCall, TrendingUp, UserPlus, UsersRound, Repeat } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { ReportFilters, parseReportFilters, toQuery } from "@/features/reports/filters";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ChartCard } from "@/components/charts/chart-card";
import { GroupedBars, HBarList, TrendArea } from "@/components/charts/charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatNumber, todayIn, toDate } from "@/lib/format";

export const metadata = { title: "Reports" };

type Retention = { services_window: number; members: number; regular: number; occasional: number; rare: number; none: number };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const ctx = await requireChurch("reports.view");
  const sp = await searchParams;
  const today = todayIn(ctx.church.timezone);
  const f = parseReportFilters(sp, { from: format(subMonths(toDate(today)!, 5), "yyyy-MM-01"), to: today });
  const supabase = await createClient();
  const church = ctx.church.id;
  const label = (d: string | null) => (d ? formatDate(d, f.bucket === "week" ? "d MMM" : "MMM yy") : "");

  const [att, services, growth, visitors, followups, departments, retention, types, depts] = await Promise.all([
    supabase.rpc("report_attendance", {
      p_church: church,
      p_from: f.from,
      p_to: f.to,
      p_bucket: f.bucket,
      p_service_type: f.service_type,
      p_department: f.department,
      p_member_status: f.member_status,
    }),
    supabase.rpc("report_service_attendance", {
      p_church: church,
      p_from: f.from,
      p_to: f.to,
      p_service_type: f.service_type,
      p_department: f.department,
      p_member_status: f.member_status,
    }),
    supabase.rpc("report_member_growth", { p_church: church, p_from: f.from, p_to: f.to, p_bucket: f.bucket }),
    supabase.rpc("report_visitors", { p_church: church, p_from: f.from, p_to: f.to, p_bucket: f.bucket }),
    supabase.rpc("report_followup_performance", { p_church: church, p_from: f.from, p_to: f.to }),
    supabase.rpc("report_department_membership", { p_church: church }),
    supabase.rpc("report_retention", { p_church: church }),
    supabase.from("service_types").select("id, name").eq("church_id", church).order("name"),
    supabase.from("departments").select("id, name").eq("church_id", church).order("name"),
  ]);

  const attData = (att.data ?? []).map((r) => ({ label: label(r.period), present: Number(r.present ?? 0), services: Number(r.services ?? 0), average: Number(r.avg_per_service ?? 0) }));
  const growthData = (growth.data ?? []).map((r) => ({ label: label(r.period), new_members: Number(r.new_members ?? 0), total: Number(r.total_members ?? 0) }));
  const visitorData = (visitors.data ?? []).map((r) => ({ label: label(r.period), visitors: Number(r.visitors ?? 0), converted: Number(r.converted ?? 0) }));
  const totalVisitors = visitorData.reduce((s, v) => s + v.visitors, 0);
  const totalConverted = visitorData.reduce((s, v) => s + v.converted, 0);
  const totalNew = growthData.reduce((s, v) => s + v.new_members, 0);
  const totalPresent = attData.reduce((s, v) => s + v.present, 0);
  const totalServices = attData.reduce((s, v) => s + v.services, 0);
  const ret = (retention.data ?? null) as Retention | null;
  const q = toQuery(f);
  const canExport = ctx.can("data.export", "reports.view");

  return (
    <>
      <PageHeader title="Reports" crumbs={[{ label: "Insights" }, { label: "Reports" }]} description={`${formatDate(f.from)} – ${formatDate(f.to)}`} />
      <ReportFilters values={f} action="/reports" serviceTypes={types.data ?? []} departments={depts.data ?? []} />

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Period totals">
        {[
          ["Attendance (people present)", formatNumber(totalPresent), `${totalServices} services`],
          ["Average per service", totalServices ? formatNumber(Math.round(totalPresent / totalServices)) : "—", "people"],
          ["New members", formatNumber(totalNew), "joined in period"],
          ["Visitor conversion", totalVisitors ? `${Math.round((totalConverted / totalVisitors) * 100)}%` : "—", `${totalConverted} of ${totalVisitors} visitors`],
        ].map(([l, v, d]) => (
          <Card key={l} className="p-4">
            <p className="text-xs font-medium text-muted-foreground">{l}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{v}</p>
            <p className="text-xs text-muted-foreground">{d}</p>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={`${f.bucket === "week" ? "Weekly" : "Monthly"} attendance`}
          description="People present (members + visitors)"
          icon={<TrendingUp className="size-4 text-primary" aria-hidden />}
          data={attData}
          series={[
            { key: "present", label: "Present" },
            { key: "services", label: "Services" },
            { key: "average", label: "Average per service" },
          ]}
        >
          <TrendArea data={attData} series={{ key: "present", label: "Present" }} />
        </ChartCard>
        <ChartCard
          title="Member growth"
          description="New members joining"
          icon={<UsersRound className="size-4 text-primary" aria-hidden />}
          data={growthData}
          series={[
            { key: "new_members", label: "New members" },
            { key: "total", label: "Total members" },
          ]}
        >
          <GroupedBars data={growthData} series={[{ key: "new_members", label: "New members" }]} />
        </ChartCard>
        <ChartCard
          title="Visitors & conversion"
          icon={<UserPlus className="size-4 text-primary" aria-hidden />}
          data={visitorData}
          series={[
            { key: "visitors", label: "Visitors" },
            { key: "converted", label: "Converted" },
          ]}
        >
          <GroupedBars
            data={visitorData}
            series={[
              { key: "visitors", label: "Visitors" },
              { key: "converted", label: "Converted" },
            ]}
          />
        </ChartCard>
        <Card>
          <CardHeader>
            <CardTitle>
              <Repeat className="size-4 text-primary" aria-hidden /> Retention indicators
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!ret || ret.members === 0 || ret.services_window === 0 ? (
              <EmptyState title="Not enough data yet" description="Retention is based on the last 8 services counted for member care." className="py-8" />
            ) : (
              <div className="grid gap-4">
                <p className="text-sm text-muted-foreground">
                  Of {ret.members} active/new/inactive members, attendance across the last {ret.services_window} services:
                </p>
                {[
                  ["Regular (6+ services)", ret.regular, "bg-success"],
                  ["Occasional (2–5)", ret.occasional, "bg-chart-2"],
                  ["Rare (1)", ret.rare, "bg-warning"],
                  ["Not attended", ret.none, "bg-destructive"],
                ].map(([l, v, c]) => (
                  <div key={l as string}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{l}</span>
                      <span className="tabular-nums">
                        {v as number} ({Math.round(((v as number) / ret.members) * 100)}%)
                      </span>
                    </div>
                    <Progress value={((v as number) / ret.members) * 100} indicatorClassName={c as string} label={l as string} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle>Attendance by service</CardTitle>
          {canExport && (
            <Button asChild variant="outline" size="sm">
              <a download href={`/api/export/service-attendance?${q}`}>
                <Download /> CSV
              </a>
            </Button>
          )}
        </CardHeader>
        {(services.data ?? []).length === 0 ? (
          <EmptyState title="No services in this period" />
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Visitors</TableHead>
                  <TableHead className="text-right">Excused</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.data!.map((s) => (
                  <TableRow key={s.service_id}>
                    <TableCell className="whitespace-nowrap">{formatDate(s.service_date, "EEE d MMM")}</TableCell>
                    <TableCell>{s.service_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.present}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.visitors}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.excused}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle>
              <PhoneCall className="size-4 text-primary" aria-hidden /> Follow-up performance
            </CardTitle>
            {canExport && (
              <Button asChild variant="outline" size="sm">
                <a download href={`/api/export/followup-performance?${q}`}>
                  <Download /> CSV
                </a>
              </Button>
            )}
          </CardHeader>
          {(followups.data ?? []).length === 0 ? (
            <EmptyState title="No follow-ups due in this period" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">Done</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {followups.data!.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell>{r.worker_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.assigned}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.completed}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.overdue}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.completion_rate ?? 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <UsersRound className="size-4 text-primary" aria-hidden /> Department membership
            </CardTitle>
            {canExport && (
              <Button asChild variant="outline" size="sm">
                <a download href="/api/export/departments">
                  <Download /> CSV
                </a>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {(departments.data ?? []).length === 0 ? (
              <EmptyState title="No departments yet" className="py-8" />
            ) : (
              <HBarList
                items={departments.data!.map((d) => ({
                  label: d.name ?? "",
                  value: Number(d.active_members ?? 0),
                  detail: d.joined_90d ? `+${d.joined_90d} in 90 days` : undefined,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        PDF export: use your browser&apos;s Print → Save as PDF on this page. A dedicated PDF export is planned (see README).
      </p>
    </>
  );
}
