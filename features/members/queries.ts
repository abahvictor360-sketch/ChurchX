import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { pageRange, PAGE_SIZE } from "@/components/app/pagination";
import { MEMBER_STATUSES } from "@/lib/validation";

export type MemberListParams = {
  q?: string;
  status?: string;
  department?: string;
  gender?: string;
  sort?: string;
  page: number;
};

const SORTS: Record<string, { column: string; ascending: boolean }> = {
  name: { column: "first_name", ascending: true },
  newest: { column: "join_date", ascending: false },
  oldest: { column: "join_date", ascending: true },
  number: { column: "membership_number", ascending: true },
};

/** Escapes LIKE wildcards in user input. */
export function likeEscape(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[,()]/g, " ");
}

export async function listMembers(supabase: ServerSupabase, churchId: string, p: MemberListParams, pageSize = PAGE_SIZE) {
  const { from, to } = pageRange(p.page, pageSize);
  const select = p.department
    ? "id, first_name, last_name, full_name, phone, email, gender, membership_status, membership_number, join_date, photo_path, department_members!inner(department_id)"
    : "id, first_name, last_name, full_name, phone, email, gender, membership_status, membership_number, join_date, photo_path";
  let q = supabase.from("members").select(select, { count: "exact" }).eq("church_id", churchId);
  if (p.q) q = q.ilike("search_text", `%${likeEscape(p.q.toLowerCase())}%`);
  if (p.status && (MEMBER_STATUSES as readonly string[]).includes(p.status)) q = q.eq("membership_status", p.status);
  else q = q.neq("membership_status", "archived");
  if (p.gender === "male" || p.gender === "female") q = q.eq("gender", p.gender);
  if (p.department) q = q.eq("department_members.department_id", p.department).is("department_members.left_on", null);
  const sort = SORTS[p.sort ?? "name"] ?? SORTS.name;
  q = q.order(sort.column, { ascending: sort.ascending, nullsFirst: false });
  if (sort.column === "first_name") q = q.order("last_name", { ascending: true });
  const { data, count, error } = await q.range(from, to);
  if (error) console.error("[members] list failed", error.code);
  type Row = {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    gender: string | null;
    membership_status: string;
    membership_number: string | null;
    join_date: string;
    photo_path: string | null;
  };
  return { rows: ((data ?? []) as unknown as Row[]), total: count ?? 0, error };
}

export async function listDepartmentsBrief(supabase: ServerSupabase, churchId: string) {
  const { data } = await supabase.from("departments").select("id, name").eq("church_id", churchId).eq("status", "active").order("name");
  return data ?? [];
}

export async function listWorkers(supabase: ServerSupabase, churchId: string) {
  const { data } = await supabase
    .from("church_users")
    .select("user_id, role, profiles:user_id(full_name, email)")
    .eq("church_id", churchId)
    .eq("status", "active");
  return (data ?? []).map((u) => ({
    id: u.user_id,
    role: u.role,
    name: (u.profiles as { full_name: string | null; email: string | null } | null)?.full_name ?? (u.profiles as { email: string | null } | null)?.email ?? "User",
  }));
}

export async function signedPhotoUrl(supabase: ServerSupabase, path: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage.from("member-photos").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
