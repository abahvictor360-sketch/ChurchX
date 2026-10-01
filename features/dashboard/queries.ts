import "server-only";
import { format, subMonths, subWeeks } from "date-fns";
import type { ChurchContext } from "@/lib/auth/context";
import type { ServerSupabase } from "@/lib/supabase/server";
import { toDate } from "@/lib/format";

export type DashboardSummary = {
  today?: string;
  total_members?: number;
  active_members?: number;
  new_members_month?: number;
  visitors_month?: number;
  visitors_awaiting?: number;
  attendance_week?: number;
  attendance_last_week?: number;
  needs_attention?: number;
  giving_month?: number;
  giving_prev_month?: number;
  my_followups_today?: number;
  my_followups_overdue?: number;
  upcoming_services?: { id: string; name: string; service_date: string; start_time: string | null; status: string }[];
  upcoming_events?: { id: string; name: string; start_date: string; end_date: string; venue: string | null }[];
};

const label = (d: string | null, bucket: "week" | "month") => {
  const date = toDate(d);
  return date ? format(date, bucket === "week" ? "d MMM" : "MMM yy") : "";
};

export async function loadDashboard(supabase: ServerSupabase, ctx: ChurchContext) {
  const church = ctx.church.id;
  // Recompute member-care alerts & notifications (throttled in SQL to every 10 minutes).
  const refresh = await supabase.rpc("refresh_member_care", { p_church: church });
  if (refresh.error) console.error("[dashboard] care refresh failed", refresh.error.code);

  const today = new Date();
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  const canReports = ctx.can("reports.view");
  const canAttendance = canReports || ctx.can("attendance.view");
  const canGiving = ctx.can("giving.view");

  const [summary, attendance, growth, visitors, giving, care] = await Promise.all([
    supabase.rpc("dashboard_summary", { p_church: church }),
    canAttendance
      ? supabase.rpc("report_attendance", { p_church: church, p_from: iso(subWeeks(today, 11)), p_to: iso(today), p_bucket: "week" })
      : null,
    canReports ? supabase.rpc("report_member_growth", { p_church: church, p_from: iso(subMonths(today, 11)), p_to: iso(today), p_bucket: "month" }) : null,
    canReports ? supabase.rpc("report_visitors", { p_church: church, p_from: iso(subMonths(today, 5)), p_to: iso(today), p_bucket: "month" }) : null,
    canGiving ? supabase.rpc("report_giving_trend", { p_church: church, p_from: iso(subMonths(today, 5)), p_to: iso(today), p_bucket: "month" }) : null,
    ctx.can("care.view") ? supabase.rpc("member_care_summary", { p_church: church }) : null,
  ]);

  return {
    summary: (summary.data ?? {}) as DashboardSummary,
    attendance: attendance?.data?.map((r) => ({ label: label(r.period, "week"), present: Number(r.present ?? 0), services: Number(r.services ?? 0) })) ?? null,
    growth: growth?.data?.map((r) => ({ label: label(r.period, "month"), new_members: Number(r.new_members ?? 0), total: Number(r.total_members ?? 0) })) ?? null,
    visitors: visitors?.data?.map((r) => ({ label: label(r.period, "month"), visitors: Number(r.visitors ?? 0), converted: Number(r.converted ?? 0) })) ?? null,
    giving: giving?.data?.map((r) => ({ label: label(r.period, "month"), total: Number(r.total ?? 0) })) ?? null,
    care: care?.data?.map((r) => ({ type: r.alert_type ?? "", count: Number(r.open_count ?? 0) })) ?? null,
  };
}
