"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard } from "@/lib/auth/action";
import { fail, invalid, type ActionResult } from "@/lib/actions";
import { departmentSchema, formToObject } from "@/lib/validation";

export async function saveDepartment(id: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard("departments.manage");
  if (!g.ok) return g.result;
  const parsed = departmentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const res = id
    ? await g.supabase.from("departments").update(parsed.data).eq("id", z.uuid().parse(id)).eq("church_id", g.churchId).select("id").single()
    : await g.supabase.from("departments").insert({ ...parsed.data, church_id: g.churchId }).select("id").single();
  if (res.error?.code === "23505") return { ok: false, error: "A department with this name already exists.", fieldErrors: { name: "Name already in use" } };
  if (res.error || !res.data) return fail(res.error, "save the department");
  // Leaders are automatically counted as department members.
  const leaders = [parsed.data.leader_member_id, parsed.data.assistant_member_id].filter((x): x is string => Boolean(x));
  if (leaders.length) await ensureMembers(g, res.data.id, leaders);
  revalidatePath("/departments", "layout");
  return { ok: true, message: id ? "Department updated" : "Department created" };
}

async function ensureMembers(g: Extract<Awaited<ReturnType<typeof guard>>, { ok: true }>, departmentId: string, memberIds: string[]) {
  const { data } = await g.supabase.from("department_members").select("member_id").eq("department_id", departmentId).is("left_on", null).in("member_id", memberIds);
  const have = new Set((data ?? []).map((d) => d.member_id));
  const rows = memberIds.filter((m) => !have.has(m)).map((member_id) => ({ church_id: g.churchId, department_id: departmentId, member_id }));
  if (rows.length) await g.supabase.from("department_members").insert(rows);
}

export async function addDepartmentMember(departmentId: string, memberId: string): Promise<ActionResult> {
  const g = await guard("departments.manage");
  if (!g.ok) return g.result;
  const parsed = z.object({ d: z.uuid(), m: z.uuid() }).safeParse({ d: departmentId, m: memberId });
  if (!parsed.success) return { ok: false, error: "Choose a member." };
  const { error } = await g.supabase.from("department_members").insert({ church_id: g.churchId, department_id: parsed.data.d, member_id: parsed.data.m });
  if (error?.code === "23505") return { ok: false, error: "Already a member of this department." };
  if (error) return fail(error, "add the member");
  revalidatePath(`/departments/${parsed.data.d}`);
  return { ok: true, message: "Member added" };
}
