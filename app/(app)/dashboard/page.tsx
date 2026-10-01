import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  Church,
  ClipboardCheck,
  HandCoins,
  HeartHandshake,
  PhoneCall,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { loadDashboard } from "@/features/dashboard/queries";
import { CARE_LABELS, CARE_ORDER } from "@/features/care/labels";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/charts/chart-card";
import { GroupedBars, TrendArea } from "@/components/charts/charts";
import { formatDate, formatMoney, formatNumber, formatTime, percentChange } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireChurch();
  const supabase = await createClient();
  const { summary: s, attendance, growth, visitors, giving, care } = await loadDashboard(supabase, ctx);
  const currency = ctx.church.currency;
  const careTotal = care?.reduce((n, c) => n + c.count, 0) ?? 0;
  const firstName = (ctx.fullName ?? "").split(" ")[0];

  const quick = [
    { href: "/visitors/new", label: "Register visitor", icon: UserPlus, show: ctx.can("visitors.create", "visitors.manage") },
    { href: "/attendance", label: "Take attendance", icon: ClipboardCheck, show: ctx.can("attendance.record") },
    { href: "/members/new", label: "Add member", icon: Users, show: ctx.can("members.manage") },
    { href: "/followups?view=today", label: "Today's follow-ups", icon: PhoneCall, show: true },
    { href: "/giving/new", label: "Record giving", icon: HandCoins, show: ctx.can("giving.manage") },
    { href: "/services?new=1", label: "Schedule service", icon: Church, show: ctx.can("services.manage") },
  ].filter((q) => q.show);

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome, ${firstName}` : "Dashboard"}
        crumbs={[{ label: "Dashboard" }]}
        actions={
          <>
            {typeof s.visitors_awaiting === "number" && (
              <Link href="/visitors?status=new" className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm shadow-xs hover:bg-muted">
                <span className="flex size-6 items-center justify-center rounded bg-success text-success-foreground">
                  <UserPlus className="size-3.5" aria-hidden />
                </span>
                New visitors <strong className="tabular-nums">{s.visitors_awaiting}</strong>
              </Link>
            )}
            {typeof s.needs_attention === "number" && (
              <Link href="/care" className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm shadow-xs hover:bg-muted">
                <span className="flex size-6 items-center justify-center rounded bg-destructive text-destructive-foreground">
                  <AlertCircle className="size-3.5" aria-hidden />
                </span>
                Needs attention <strong className="tabular-nums">{s.needs_attention}</strong>
              </Link>
            )}
          </>
        }
      />

      {/* KPI row */}
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {typeof s.total_members === "number" && (
          <StatCard
            label="Total members"
            value={formatNumber(s.total_members)}
            caption={`${formatNumber(s.active_members ?? 0)} active`}
            icon={Users}
            href="/members"
            bars={growth?.slice(-8).map((g) => g.total)}
          />
        )}
        {typeof s.new_members_month === "number" && (
          <StatCard
            label="New members"
            value={formatNumber(s.new_members_month)}
            caption="this month"
            icon={UserCheck}
            tone="teal"
            href="/members?status=new_member"
            bars={growth?.slice(-8).map((g) => g.new_members)}
          />
        )}
        {typeof s.visitors_month === "number" && (
          <StatCard
            label="First-time visitors"
            value={formatNumber(s.visitors_month)}
            caption={`this month · ${s.visitors_awaiting ?? 0} awaiting follow-up`}
            icon={UserPlus}
            href="/visitors"
            bars={visitors?.map((v) => v.visitors)}
          />
        )}
        {typeof s.attendance_week === "number" && (
          <StatCard
            label="Attendance this week"
            value={formatNumber(s.attendance_week)}
            caption="vs last week"
            trend={percentChange(s.attendance_week, s.attendance_last_week ?? 0)}
            icon={ClipboardCheck}
            tone="teal"
            href="/attendance"
            bars={attendance?.slice(-8).map((a) => a.present)}
          />
        )}
        {typeof s.giving_month === "number" && (
          <StatCard
            label="Giving this month"
            value={formatMoney(s.giving_month, currency, true)}
            caption="vs last month"
            trend={percentChange(Number(s.giving_month), Number(s.giving_prev_month ?? 0))}
            icon={HandCoins}
            tone="green"
            href="/reports/finance"
            bars={giving?.map((g) => g.total)}
          />
        )}
        {typeof s.needs_attention === "number" && (
          <StatCard label="Members needing attention" value={formatNumber(s.needs_attention)} caption="open care alerts" icon={HeartHandshake} tone="red" href="/care" />
        )}
        <StatCard
          label="My follow-ups today"
          value={formatNumber(s.my_followups_today ?? 0)}
          caption={s.my_followups_overdue ? `${s.my_followups_overdue} overdue` : "nothing overdue"}
          icon={PhoneCall}
          tone={s.my_followups_overdue ? "red" : "orange"}
          href="/followups?view=today"
        />
        {s.upcoming_services && (
          <StatCard
            label="Upcoming services"
            value={formatNumber(s.upcoming_services.length)}
            caption={s.upcoming_services[0] ? `Next: ${formatDate(s.upcoming_services[0].service_date, "EEE d MMM")}` : "none scheduled"}
            icon={Church}
            tone="teal"
            href="/services"
          />
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {attendance ? (
            <ChartCard
              title="Attendance trend"
              description="People present per week (last 12 weeks)"
              icon={<TrendingUp className="size-4 text-primary" aria-hidden />}
              data={attendance}
              series={[{ key: "present", label: "Present" }]}
              emptyText="Attendance will appear here once services are recorded."
            >
              <TrendArea data={attendance} series={{ key: "present", label: "Present" }} height={280} />
            </ChartCard>
          ) : (
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  <CalendarDays className="size-4 text-primary" aria-hidden /> Upcoming services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UpcomingServices items={s.upcoming_services ?? []} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid gap-4">
          {care && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <HeartHandshake className="size-4 text-primary" aria-hidden /> Member care
                </CardTitle>
                <Button asChild variant="link" size="sm" className="h-auto p-0">
                  <Link href="/care">Open</Link>
                </Button>
              </CardHeader>
              <CardContent className="pt-3">
                {careTotal === 0 ? (
                  <p className="text-sm text-muted-foreground">No one is flagged right now. Alerts appear when people miss services, birthdays come up, or follow-ups are overdue.</p>
                ) : (
                  <ul className="grid gap-2">
                    {CARE_ORDER.map((type) => {
                      const c = care.find((x) => x.type === type);
                      if (!c?.count) return null;
                      return (
                        <li key={type}>
                          <Link href={`/care?type=${type}`} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                            <span>{CARE_LABELS[type]?.label ?? type}</span>
                            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground tabular-nums">{c.count}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-2 gap-y-4 pt-4 sm:grid-cols-3 lg:grid-cols-2">
              {quick.map((q) => (
                <Link key={q.href} href={q.href} className="group flex flex-col items-center gap-2 rounded-md p-2 text-center text-xs font-medium hover:bg-muted">
                  <span className="flex size-11 items-center justify-center rounded-full bg-foreground text-background transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <q.icon className="size-4" aria-hidden />
                  </span>
                  {q.label}
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {(growth || visitors) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {growth && (
            <ChartCard
              title="Membership growth"
              description="New members joining per month"
              icon={<UsersRound className="size-4 text-primary" aria-hidden />}
              data={growth}
              series={[
                { key: "new_members", label: "New members" },
                { key: "total", label: "Total members" },
              ]}
            >
              <GroupedBars data={growth} series={[{ key: "new_members", label: "New members" }]} />
            </ChartCard>
          )}
          {visitors && (
            <ChartCard
              title="Visitor conversion"
              description="First-time visitors and how many became members"
              icon={<UserPlus className="size-4 text-primary" aria-hidden />}
              data={visitors}
              series={[
                { key: "visitors", label: "Visitors" },
                { key: "converted", label: "Converted" },
              ]}
            >
              <GroupedBars
                data={visitors}
                series={[
                  { key: "visitors", label: "Visitors" },
                  { key: "converted", label: "Converted" },
                ]}
              />
            </ChartCard>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {attendance && s.upcoming_services && (
          <Card>
            <CardHeader>
              <CardTitle>
                <Church className="size-4 text-primary" aria-hidden /> Upcoming services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UpcomingServices items={s.upcoming_services} />
            </CardContent>
          </Card>
        )}
        {s.upcoming_events && (
          <Card>
            <CardHeader>
              <CardTitle>
                <CalendarDays className="size-4 text-primary" aria-hidden /> Upcoming events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {s.upcoming_events.length === 0 ? (
                <EmptyState title="No upcoming events" className="py-6" />
              ) : (
                <ul className="divide-y">
                  {s.upcoming_events.map((e) => (
                    <li key={e.id}>
                      <Link href={`/events/${e.id}`} className="flex items-center gap-3 py-2.5 hover:text-primary">
                        <DateChip date={e.start_date} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{e.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{e.venue ?? "Venue TBC"}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
        {giving && (
          <ChartCard
            title="Giving trend"
            description="Recorded contributions per month"
            icon={<HandCoins className="size-4 text-primary" aria-hidden />}
            data={giving}
            series={[{ key: "total", label: "Total" }]}
            format={{ kind: "money", currency }}
          >
            <GroupedBars data={giving} series={[{ key: "total", label: "Total" }]} format={{ kind: "money", currency }} height={220} />
          </ChartCard>
        )}
      </div>
    </>
  );
}

function DateChip({ date }: { date: string }) {
  return (
    <span className="flex w-11 shrink-0 flex-col items-center rounded-md border bg-accent py-1 text-accent-foreground">
      <span className="text-[10px] font-semibold uppercase">{formatDate(date, "MMM")}</span>
      <span className="text-base leading-none font-bold">{formatDate(date, "d")}</span>
    </span>
  );
}

function UpcomingServices({ items }: { items: { id: string; name: string; service_date: string; start_time: string | null }[] }) {
  if (items.length === 0) return <EmptyState title="No upcoming services" description="Schedule services to start taking attendance." className="py-6" />;
  return (
    <ul className="divide-y">
      {items.map((sv) => (
        <li key={sv.id}>
          <Link href={`/attendance/${sv.id}`} className="flex items-center gap-3 py-2.5 hover:text-primary">
            <DateChip date={sv.service_date} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{sv.name}</span>
              <span className="block text-xs text-muted-foreground">{sv.start_time ? formatTime(sv.start_time) : "Time not set"}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
