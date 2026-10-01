import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ClipboardCheck, MapPin, Clock } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { ServiceDialog } from "@/features/services/service-dialog";
import { ServiceStatusMenu } from "@/features/services/service-controls";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatTime, todayIn } from "@/lib/format";

export const metadata = { title: "Service" };

export default async function ServicePage({ params }: PageProps<"/services/[id]">) {
  const ctx = await requireChurch("services.view", "services.manage", "attendance.record");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: s } = await supabase.from("services").select("*, service_types(name)").eq("id", id).eq("church_id", ctx.church.id).maybeSingle();
  if (!s) notFound();
  const canSeeAttendance = ctx.can("attendance.view", "reports.view");
  const [{ data: types }, report, { count: visitorCount }] = await Promise.all([
    supabase.from("service_types").select("id, name, default_start_time, default_end_time").eq("church_id", ctx.church.id).eq("is_active", true).order("name"),
    canSeeAttendance ? supabase.rpc("report_service_attendance", { p_church: ctx.church.id, p_from: s.service_date, p_to: s.service_date }) : null,
    supabase.from("visitors").select("id", { count: "exact", head: true }).eq("service_id", id),
  ]);
  const stats = report?.data?.find((r) => r.service_id === id);
  const canManage = ctx.can("services.manage");

  return (
    <>
      <PageHeader
        title={s.name}
        crumbs={[{ label: "Services", href: "/services" }, { label: s.name }]}
        actions={
          <>
            {canManage && <ServiceStatusMenu id={s.id} status={s.status} />}
            {canManage && <ServiceDialog service={s} types={types ?? []} today={todayIn(ctx.church.timezone)} />}
            {ctx.can("attendance.record", "attendance.view") && s.status !== "cancelled" && (
              <Button asChild size="sm">
                <Link href={`/attendance/${s.id}`}>
                  <ClipboardCheck /> Attendance
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <StatusBadge status={s.status} />
            <p className="font-medium">{formatDate(s.service_date, "EEEE d MMMM yyyy")}</p>
            <p className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" aria-hidden />
              {s.start_time ? `${formatTime(s.start_time)}${s.end_time ? ` – ${formatTime(s.end_time)}` : ""}` : "Time not set"}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" aria-hidden />
              {s.location ?? "Location not set"}
            </p>
            {s.service_types?.name && <p className="text-muted-foreground">Type: {s.service_types.name}</p>}
            {s.notes && <p className="rounded-md bg-muted p-3 whitespace-pre-wrap">{s.notes}</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Attendance summary</CardTitle>
          </CardHeader>
          <CardContent>
            {canSeeAttendance ? (
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["Members present", stats?.present ?? 0],
                  ["Visitors present", stats?.visitors ?? 0],
                  ["Excused", stats?.excused ?? 0],
                  ["First-timers registered", visitorCount ?? 0],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg border p-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-2xl font-bold tabular-nums">{Number(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Open Attendance to check people in.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
