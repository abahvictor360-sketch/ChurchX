import { NextResponse, type NextRequest } from "next/server";
import { getChurchContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { csvResponse, toCsv } from "@/lib/csv";
import { likeEscape } from "@/features/members/queries";
import { MEMBER_STATUSES, PAYMENT_METHODS } from "@/lib/validation";
import type { Permission } from "@/lib/permissions";

const MAX_ROWS = 10000;
const isDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/**
 * CSV exports. Every export runs with the signed-in user's session, so RLS
 * guarantees only their church's rows (and only what their role may see)
 * are included. Each entity additionally requires explicit permissions.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/export/[entity]">) {
  const { entity } = await ctx.params;
  const church = await getChurchContext();
  if (!church) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const need: Record<string, Permission[][]> = {
    members: [["data.export"], ["members.view"]],
    visitors: [["data.export"], ["visitors.view"]],
    contributions: [["data.export"], ["giving.view"]],
    "service-attendance": [["data.export", "reports.view"], ["reports.view", "attendance.view"]],
    "followup-performance": [["data.export", "reports.view"], ["reports.view", "followups.view_all"]],
    departments: [["data.export", "reports.view"], ["reports.view", "departments.view"]],
    "giving-breakdown": [["data.export", "reports.finance"], ["giving.view", "reports.finance"]],
    "giving-trend": [["data.export", "reports.finance"], ["giving.view", "reports.finance"]],
  };
  const rules = need[entity];
  if (!rules) return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  if (!rules.every((anyOf) => church.can(...anyOf))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const supabase = await createClient();
  const id = church.church.id;
  const stamp = new Date().toISOString().slice(0, 10);
  const from = isDate(sp.get("from")) ?? `${new Date().getFullYear()}-01-01`;
  const to = isDate(sp.get("to")) ?? stamp;

  try {
    switch (entity) {
      case "members": {
        let q = supabase
          .from("members")
          .select("membership_number, first_name, middle_name, last_name, gender, date_of_birth, phone, email, address, city, state, country, marital_status, membership_status, join_date, occupation, emergency_contact_name, emergency_contact_phone")
          .eq("church_id", id);
        const status = sp.get("status");
        if (status && (MEMBER_STATUSES as readonly string[]).includes(status)) q = q.eq("membership_status", status);
        const query = sp.get("q");
        if (query) q = q.ilike("search_text", `%${likeEscape(query.toLowerCase())}%`);
        const gender = sp.get("gender");
        if (gender === "male" || gender === "female") q = q.eq("gender", gender);
        const { data, error } = await q.order("last_name").limit(MAX_ROWS);
        if (error) throw error;
        const cols = Object.keys(data?.[0] ?? { membership_number: "" }).map((k) => ({ key: k, label: k }));
        return csvResponse(toCsv(data ?? [], cols), `members-${stamp}.csv`);
      }
      case "visitors": {
        const { data, error } = await supabase
          .from("visitors")
          .select("first_name, last_name, phone, email, gender, address, heard_about, invited_by, visit_date, status")
          .eq("church_id", id)
          .order("visit_date", { ascending: false })
          .limit(MAX_ROWS);
        if (error) throw error;
        const cols = ["first_name", "last_name", "phone", "email", "gender", "address", "heard_about", "invited_by", "visit_date", "status"].map((k) => ({ key: k, label: k }));
        return csvResponse(toCsv(data ?? [], cols), `visitors-${stamp}.csv`);
      }
      case "contributions": {
        let q = supabase
          .from("contributions")
          .select("contribution_date, amount, currency, payment_method, reference, status, is_anonymous, contributor_name, notes, members(full_name, membership_number), giving_categories(name)")
          .eq("church_id", id)
          .gte("contribution_date", from)
          .lte("contribution_date", to);
        const status = sp.get("status");
        if (status !== "all") q = q.eq("status", status === "voided" ? "voided" : "recorded");
        const cat = sp.get("category");
        if (cat && /^[0-9a-f-]{36}$/.test(cat)) q = q.eq("category_id", cat);
        const method = sp.get("method");
        if (method && (PAYMENT_METHODS as readonly string[]).includes(method)) q = q.eq("payment_method", method);
        const { data, error } = await q.order("contribution_date").limit(MAX_ROWS);
        if (error) throw error;
        const rows = (data ?? []).map((c) => ({
          date: c.contribution_date,
          contributor: c.is_anonymous ? "Anonymous" : (c.members?.full_name ?? c.contributor_name ?? ""),
          membership_number: c.members?.membership_number ?? "",
          category: c.giving_categories?.name ?? "",
          amount: c.amount,
          currency: c.currency,
          payment_method: c.payment_method,
          reference: c.reference ?? "",
          status: c.status,
          notes: c.notes ?? "",
        }));
        const cols = Object.keys(rows[0] ?? { date: "" }).map((k) => ({ key: k, label: k }));
        return csvResponse(toCsv(rows, cols), `contributions-${from}-to-${to}.csv`);
      }
      case "service-attendance": {
        const { data, error } = await supabase.rpc("report_service_attendance", {
          p_church: id,
          p_from: from,
          p_to: to,
          p_service_type: sp.get("service_type") || undefined,
          p_department: sp.get("department") || undefined,
          p_member_status: sp.get("member_status") || undefined,
        });
        if (error) throw error;
        const cols = ["service_date", "service_name", "service_status", "present", "visitors", "excused", "absent"].map((k) => ({ key: k, label: k }));
        return csvResponse(toCsv(data ?? [], cols), `attendance-${from}-to-${to}.csv`);
      }
      case "followup-performance": {
        const { data, error } = await supabase.rpc("report_followup_performance", { p_church: id, p_from: from, p_to: to });
        if (error) throw error;
        const cols = ["worker_name", "assigned", "completed", "pending", "overdue", "completion_rate"].map((k) => ({ key: k, label: k }));
        return csvResponse(toCsv(data ?? [], cols), `followup-performance-${from}-to-${to}.csv`);
      }
      case "departments": {
        const { data, error } = await supabase.rpc("report_department_membership", { p_church: id });
        if (error) throw error;
        const cols = ["name", "status", "leader_name", "active_members", "joined_90d"].map((k) => ({ key: k, label: k }));
        return csvResponse(toCsv(data ?? [], cols), `departments-${stamp}.csv`);
      }
      case "giving-breakdown": {
        const by = sp.get("by") === "method" ? "method" : "category";
        const { data, error } = await supabase.rpc("report_giving_breakdown", { p_church: id, p_from: from, p_to: to, p_by: by });
        if (error) throw error;
        const cols = [
          { key: "label", label: by },
          { key: "total", label: "total" },
          { key: "contributions", label: "contributions" },
        ];
        return csvResponse(toCsv(data ?? [], cols), `giving-by-${by}-${from}-to-${to}.csv`);
      }
      case "giving-trend": {
        const { data, error } = await supabase.rpc("report_giving_trend", { p_church: id, p_from: from, p_to: to, p_bucket: "month" });
        if (error) throw error;
        const cols = ["period", "total", "contributions"].map((k) => ({ key: k, label: k }));
        return csvResponse(toCsv(data ?? [], cols), `giving-trend-${from}-to-${to}.csv`);
      }
    }
  } catch (error) {
    console.error("[export] failed", entity, (error as { code?: string }).code);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
  return NextResponse.json({ error: "Unknown export" }, { status: 404 });
}
