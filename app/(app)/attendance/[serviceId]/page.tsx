import { notFound } from "next/navigation";
import { z } from "zod";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { CheckinBoard } from "@/features/attendance/checkin-board";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDate, formatTime } from "@/lib/format";

export const metadata = { title: "Check-in" };

export default async function CheckinPage({ params }: PageProps<"/attendance/[serviceId]">) {
  const ctx = await requireChurch("attendance.record", "attendance.view");
  const { serviceId } = await params;
  if (!z.uuid().safeParse(serviceId).success) notFound();
  const supabase = await createClient();
  const { data: s } = await supabase.from("services").select("id, name, service_date, start_time, status").eq("id", serviceId).eq("church_id", ctx.church.id).maybeSingle();
  if (!s) notFound();
  const { data: list } = await supabase.rpc("service_attendance_list", { p_service: serviceId });
  const present = (list ?? []).filter((r) => r.status === "present").length;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={s.name}
        description={`${formatDate(s.service_date, "EEEE d MMMM yyyy")}${s.start_time ? ` · ${formatTime(s.start_time)}` : ""}`}
        crumbs={[{ label: "Attendance", href: "/attendance" }, { label: s.name }]}
        actions={<StatusBadge status={s.status} />}
      />
      {s.status === "cancelled" ? (
        <p className="rounded-md border bg-card p-4 text-sm">This service was cancelled. Attendance cannot be recorded.</p>
      ) : (
        <CheckinBoard
          serviceId={s.id}
          canRecord={ctx.can("attendance.record")}
          canCorrect={ctx.can("attendance.correct")}
          canRegisterVisitor={ctx.can("visitors.create", "visitors.manage")}
          initialCount={present}
        />
      )}
    </div>
  );
}
