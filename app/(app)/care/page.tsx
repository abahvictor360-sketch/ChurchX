import Link from "next/link";
import { HeartHandshake, Settings2 } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { listWorkers } from "@/features/members/queries";
import { CARE_LABELS, CARE_ORDER } from "@/features/care/labels";
import { CareAlertActions, RefreshCareButton } from "@/features/care/alert-actions";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Pagination, pageRange, parsePage } from "@/components/app/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate, todayIn } from "@/lib/format";
import { telLink, whatsappLink } from "@/lib/phone";

export const metadata = { title: "Member care" };

type Details = { missed?: number; last_present?: string | null; birthday?: string; age?: number; days?: number; due_date?: string; days_overdue?: number; recent_rate?: number; previous_rate?: number; join_date?: string };

function describe(type: string, d: Details) {
  switch (type) {
    case "absent_consecutive":
    case "absent_long":
      return `Missed ${d.missed} service${d.missed === 1 ? "" : "s"} in a row${d.last_present ? ` · last attended ${formatDate(d.last_present)}` : " · no attendance recorded since joining"}`;
    case "attendance_drop":
      return `Attendance fell from ${d.previous_rate}% to ${d.recent_rate}% in the last 4 weeks`;
    case "visitor_not_contacted":
      return `Visited ${d.days} day${d.days === 1 ? "" : "s"} ago and has not been contacted`;
    case "followup_overdue":
      return `Follow-up was due ${formatDate(d.due_date)} (${d.days_overdue} day${d.days_overdue === 1 ? "" : "s"} overdue)`;
    case "birthday_today":
      return `Turns ${d.age} today 🎂`;
    case "birthday_week":
      return `Turns ${d.age} on ${formatDate(d.birthday, "EEEE d MMM")}`;
    case "no_department":
      return `Joined ${formatDate(d.join_date)} and is not yet in a department`;
    default:
      return "";
  }
}

const URGENT = new Set(["absent_long", "followup_overdue", "attendance_drop"]);

export default async function CarePage({ searchParams }: PageProps<"/care">) {
  const ctx = await requireChurch("care.view");
  const sp = await searchParams;
  const type = typeof sp.type === "string" && CARE_LABELS[sp.type] ? sp.type : undefined;
  const page = parsePage(sp.page);
  const supabase = await createClient();
  await supabase.rpc("refresh_member_care", { p_church: ctx.church.id });
  const { from, to } = pageRange(page);

  let q = supabase
    .from("member_care_alerts")
    .select(
      "id, alert_type, details, created_at, member_id, visitor_id, members(id, full_name, first_name, phone), visitors(id, full_name, first_name, phone), profiles!care_alerts_assignee_profile_fk(full_name)",
      { count: "exact" },
    )
    .eq("church_id", ctx.church.id)
    .eq("status", "open");
  if (type) q = q.eq("alert_type", type);
  const [{ data, count, error }, summary, workers] = await Promise.all([
    q.order("created_at", { ascending: false }).range(from, to),
    supabase.rpc("member_care_summary", { p_church: ctx.church.id }),
    ctx.can("followups.manage") ? listWorkers(supabase, ctx.church.id) : Promise.resolve([]),
  ]);
  const counts = new Map((summary.data ?? []).map((s) => [s.alert_type ?? "", Number(s.open_count ?? 0)]));
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const today = todayIn(ctx.church.timezone);

  return (
    <>
      <PageHeader
        title="Member care"
        description="People who may need a call, a visit or a word of encouragement."
        crumbs={[{ label: "People" }, { label: "Member care" }]}
        actions={
          <>
            <RefreshCareButton />
            {ctx.can("church.manage") && (
              <Button asChild variant="outline" size="sm">
                <Link href="/settings/care">
                  <Settings2 /> Rules
                </Link>
              </Button>
            )}
          </>
        }
      />

      <section aria-label="Alert types" className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Link
          href="/care"
          aria-current={!type ? "page" : undefined}
          className={cn("rounded-lg border bg-card p-4 transition-shadow hover:shadow-md", !type && "border-primary ring-1 ring-primary")}
        >
          <p className="text-xs font-medium text-muted-foreground">Needs attention</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{total}</p>
        </Link>
        {CARE_ORDER.map((t) => (
          <Link
            key={t}
            href={`/care?type=${t}`}
            aria-current={type === t ? "page" : undefined}
            className={cn("rounded-lg border bg-card p-4 transition-shadow hover:shadow-md", type === t && "border-primary ring-1 ring-primary")}
          >
            <p className="text-xs font-medium text-muted-foreground">{CARE_LABELS[t].short}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{counts.get(t) ?? 0}</p>
          </Link>
        ))}
      </section>

      {error ? (
        <Card>
          <EmptyState title="Couldn't load alerts" description="Please refresh the page." />
        </Card>
      ) : (data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon={HeartHandshake}
            title={type ? `No “${CARE_LABELS[type].short}” alerts` : "Everyone is accounted for"}
            description="Alerts are generated from attendance, follow-ups, birthdays and departments using your member care rules."
          />
        </Card>
      ) : (
        <>
          <ul className="grid gap-3 lg:grid-cols-2">
            {data!.map((a) => {
              const person = a.members ?? a.visitors;
              const href = a.members ? `/members/${a.members.id}` : a.visitors ? `/visitors/${a.visitors.id}` : "#";
              const name = person?.full_name ?? "Unknown";
              return (
                <li key={a.id}>
                  <Card className="h-full gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={href} className="font-semibold hover:text-primary">
                          {name}
                        </Link>
                        <p className="text-sm text-muted-foreground">{describe(a.alert_type, (a.details ?? {}) as Details)}</p>
                      </div>
                      <Badge variant={URGENT.has(a.alert_type) ? "red" : a.alert_type.startsWith("birthday") ? "blue" : "orange"}>{CARE_LABELS[a.alert_type]?.short}</Badge>
                    </div>
                    {a.profiles?.full_name && <p className="text-xs text-muted-foreground">Assigned to {a.profiles.full_name}</p>}
                    <CareAlertActions
                      alertId={a.id}
                      name={name}
                      memberId={a.member_id}
                      visitorId={a.visitor_id}
                      tel={telLink(person?.phone)}
                      whatsapp={whatsappLink(person?.phone, a.alert_type.startsWith("birthday") ? `Happy birthday ${person?.first_name}! 🎉 ` : `Hello ${person?.first_name}, we missed you at church. `)}
                      canManage={ctx.can("care.manage")}
                      canAssign={ctx.can("followups.manage")}
                      workers={workers}
                      today={today}
                    />
                  </Card>
                </li>
              );
            })}
          </ul>
          <Card className="mt-3">
            <Pagination page={page} total={count ?? 0} basePath="/care" params={{ type }} />
          </Card>
        </>
      )}
    </>
  );
}
