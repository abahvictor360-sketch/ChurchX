import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { listWorkers } from "@/features/members/queries";
import { VisitorActions, VisitorStatusSelect } from "@/features/visitors/visitor-actions";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime, titleCase, todayIn } from "@/lib/format";
import { telLink, whatsappLink } from "@/lib/phone";

export const metadata = { title: "Visitor" };

export default async function VisitorPage({ params }: PageProps<"/visitors/[id]">) {
  const ctx = await requireChurch();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: v } = await supabase.from("visitors").select("*, services(name, service_date)").eq("id", id).eq("church_id", ctx.church.id).maybeSingle();
  if (!v) notFound();
  const today = todayIn(ctx.church.timezone);
  const [{ data: followups }, workers, { data: attendance }] = await Promise.all([
    supabase
      .from("followups")
      .select("id, due_date, status, contact_method, outcome, notes, completed_at, assigned_to, profiles!followups_assignee_profile_fk(full_name)")
      .eq("visitor_id", id)
      .order("due_date", { ascending: false }),
    ctx.can("followups.manage") ? listWorkers(supabase, ctx.church.id) : Promise.resolve([]),
    supabase.from("attendance").select("id, status, services(name, service_date)").eq("visitor_id", id).order("checked_in_at", { ascending: false }).limit(20),
  ]);
  const converted = v.status === "converted";
  const canEditStatus = ctx.can("visitors.manage") || (followups ?? []).some((f) => f.assigned_to === ctx.userId && f.status !== "cancelled");

  return (
    <>
      <PageHeader title={v.full_name} crumbs={[{ label: "Visitors", href: "/visitors" }, { label: v.full_name }]} />
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={v.status} />
              <span className="text-sm text-muted-foreground">First visit {formatDate(v.visit_date)}</span>
            </div>
            {converted && v.converted_member_id && (
              <p className="mt-2 text-sm">
                Converted to member on {formatDate(v.converted_at)} —{" "}
                <Link href={`/members/${v.converted_member_id}`} className="font-medium text-primary hover:underline">
                  view member profile
                </Link>
              </p>
            )}
          </div>
          <VisitorActions
            visitor={{ id: v.id, first_name: v.first_name, last_name: v.last_name, converted }}
            tel={telLink(v.phone)}
            whatsapp={whatsappLink(v.phone, `Hello ${v.first_name}, thank you for worshipping with us at ${ctx.church.name}! `)}
            canManage={ctx.can("visitors.manage")}
            canConvert={ctx.can("visitors.manage") && ctx.can("members.manage")}
            canAssign={ctx.can("followups.manage")}
            workers={workers}
            today={today}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              {[
                ["Phone", v.phone],
                ["Email", v.email],
                ["Gender", v.gender && titleCase(v.gender)],
                ["Address", v.address],
                ["Service attended", v.services ? `${v.services.name} (${formatDate(v.services.service_date)})` : null],
                ["Heard about us", v.heard_about],
                ["Invited by", v.invited_by],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd>{value || "—"}</dd>
                </div>
              ))}
            </dl>
            {v.prayer_request && (
              <div className="mt-4 rounded-md bg-accent/60 p-3 text-sm">
                <p className="mb-1 text-xs font-semibold text-accent-foreground">Prayer request / notes</p>
                <p className="whitespace-pre-wrap">{v.prayer_request}</p>
              </div>
            )}
            {!converted && canEditStatus && (
              <div className="mt-4 grid gap-1.5">
                <span className="text-xs text-muted-foreground">Update status</span>
                <VisitorStatusSelect id={v.id} status={v.status} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Follow-up history</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {(followups ?? []).length === 0 ? (
                <EmptyState title="No follow-ups yet" description="Assign a worker so this visitor is contacted soon." className="py-8" />
              ) : (
                <ul className="divide-y border-t">
                  {followups!.map((f) => (
                    <li key={f.id} className="px-5 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={f.status === "pending" && f.due_date < today ? "overdue" : f.status} />
                        <span className="font-medium">Due {formatDate(f.due_date)}</span>
                        <span className="text-muted-foreground">· {f.profiles?.full_name ?? "—"}</span>
                      </div>
                      {f.status === "completed" && (
                        <p className="mt-1 text-muted-foreground">
                          {titleCase(f.contact_method)} · {titleCase(f.outcome)} · {formatDateTime(f.completed_at)}
                        </p>
                      )}
                      {f.notes && <p className="mt-1 whitespace-pre-wrap">{f.notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Attendance</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {(attendance ?? []).length === 0 ? (
                <EmptyState title="No attendance recorded" className="py-8" />
              ) : (
                <ul className="divide-y border-t">
                  {attendance!.map((a) => (
                    <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <span>
                        {a.services?.name} · {formatDate(a.services?.service_date)}
                      </span>
                      <StatusBadge status={a.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
