"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { guard } from "@/lib/auth/action";
import type { ServerSupabase } from "@/lib/supabase/server";
import { fail, invalid, type ActionResult } from "@/lib/actions";
import { formToObject, MEMBER_STATUSES, memberSchema, noteSchema } from "@/lib/validation";
import { likeEscape } from "@/features/members/queries";

type DuplicateHit = { id: string; full_name: string; membership_number: string | null; reason: string };

async function findDuplicates(
  supabase: ServerSupabase,
  churchId: string,
  v: { first_name: string; last_name: string; phone: string | null; email: string | null },
  excludeId?: string,
): Promise<DuplicateHit[]> {
  const ors = [`and(first_name.ilike.${likeEscape(v.first_name)},last_name.ilike.${likeEscape(v.last_name)})`];
  if (v.phone) ors.push(`phone.eq.${v.phone}`);
  if (v.email) ors.push(`email.eq.${v.email}`);
  let q = supabase.from("members").select("id, full_name, membership_number, phone, email, first_name, last_name").eq("church_id", churchId).or(ors.join(",")).limit(5);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  return (data ?? []).map((m) => ({
    id: m.id,
    full_name: m.full_name,
    membership_number: m.membership_number,
    reason: v.phone && m.phone === v.phone ? "same phone" : v.email && m.email === v.email ? "same email" : "same name",
  }));
}

export async function saveMember(memberId: string | null, _prev: ActionResult<{ id: string; duplicates?: DuplicateHit[] }> | null, formData: FormData): Promise<ActionResult<{ id: string; duplicates?: DuplicateHit[] }>> {
  const g = await guard("members.manage");
  if (!g.ok) return g.result;
  const raw = formToObject(formData);
  const parsed = memberSchema(g.ctx.church.country).safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  if (raw.confirm_duplicate !== "on") {
    const dups = await findDuplicates(g.supabase, g.churchId, v, memberId ?? undefined);
    if (dups.length) {
      return {
        ok: false,
        error: "This person may already be registered.",
        fieldErrors: { duplicate: dups.map((d) => `${d.full_name}${d.membership_number ? ` (${d.membership_number})` : ""} — ${d.reason}`).join("; ") },
      };
    }
  }

  const payload = { ...v, membership_number: v.membership_number ?? undefined };
  if (memberId) {
    const id = z.uuid().parse(memberId);
    const { error } = await g.supabase.from("members").update(payload).eq("id", id).eq("church_id", g.churchId);
    if (error) return fail(error, "save the member");
    revalidatePath(`/members/${id}`);
    redirect(`/members/${id}?saved=1`);
  }
  const { data, error } = await g.supabase.from("members").insert({ ...payload, church_id: g.churchId }).select("id").single();
  if (error || !data) return fail(error, "add the member");
  revalidatePath("/members");
  redirect(`/members/${data.id}?created=1`);
}

const idsSchema = z.array(z.uuid()).min(1, "Select at least one person").max(500);

export async function setMembersStatus(ids: string[], status: string): Promise<ActionResult> {
  const g = await guard("members.manage");
  if (!g.ok) return g.result;
  const parsedIds = idsSchema.safeParse(ids);
  const parsedStatus = z.enum(MEMBER_STATUSES).safeParse(status);
  if (!parsedIds.success || !parsedStatus.success) return { ok: false, error: "Invalid selection." };
  const { error, count } = await g.supabase
    .from("members")
    .update({ membership_status: parsedStatus.data }, { count: "exact" })
    .in("id", parsedIds.data)
    .eq("church_id", g.churchId);
  if (error) return fail(error, "update members");
  revalidatePath("/members");
  const verb = parsedStatus.data === "archived" ? "Archived" : "Updated";
  return { ok: true, message: `${verb} ${count ?? parsedIds.data.length} ${count === 1 ? "person" : "people"}` };
}

export async function addMembersToDepartment(ids: string[], departmentId: string): Promise<ActionResult> {
  const g = await guard("departments.manage");
  if (!g.ok) return g.result;
  const parsedIds = idsSchema.safeParse(ids);
  const dept = z.uuid().safeParse(departmentId);
  if (!parsedIds.success || !dept.success) return { ok: false, error: "Invalid selection." };
  const { data: existing } = await g.supabase
    .from("department_members")
    .select("member_id")
    .eq("department_id", dept.data)
    .is("left_on", null)
    .in("member_id", parsedIds.data);
  const already = new Set((existing ?? []).map((e) => e.member_id));
  const rows = parsedIds.data.filter((id) => !already.has(id)).map((member_id) => ({ church_id: g.churchId, department_id: dept.data, member_id }));
  if (rows.length) {
    const { error } = await g.supabase.from("department_members").insert(rows);
    if (error) return fail(error, "add to department");
  }
  revalidatePath("/members");
  revalidatePath(`/departments/${dept.data}`);
  return { ok: true, message: rows.length ? `Added ${rows.length} to the department` : "Everyone selected is already in that department" };
}

export async function addMemberNote(memberId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard("members.notes", "members.manage");
  if (!g.ok) return g.result;
  const parsed = noteSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.visibility === "confidential" && !g.ctx.can("members.view_sensitive")) {
    return { ok: false, error: "You cannot add confidential notes." };
  }
  const { error } = await g.supabase
    .from("member_notes")
    .insert({ church_id: g.churchId, member_id: z.uuid().parse(memberId), body: parsed.data.body, visibility: parsed.data.visibility });
  if (error) return fail(error, "save the note");
  revalidatePath(`/members/${memberId}`);
  return { ok: true, message: "Note added" };
}

export async function setMemberPhoto(memberId: string, path: string | null): Promise<ActionResult> {
  const g = await guard("members.manage");
  if (!g.ok) return g.result;
  const id = z.uuid().safeParse(memberId);
  if (!id.success) return { ok: false, error: "Invalid member." };
  if (path !== null && !path.startsWith(`${g.churchId}/${id.data}/`)) return { ok: false, error: "Invalid file." };
  const { error } = await g.supabase.from("members").update({ photo_path: path }).eq("id", id.data).eq("church_id", g.churchId);
  if (error) return fail(error, "save the photo");
  revalidatePath(`/members/${id.data}`);
  return { ok: true, message: path ? "Photo updated" : "Photo removed" };
}

export async function leaveDepartment(departmentMemberId: string): Promise<ActionResult> {
  const g = await guard("departments.manage");
  if (!g.ok) return g.result;
  const id = z.uuid().safeParse(departmentMemberId);
  if (!id.success) return { ok: false, error: "Invalid selection." };
  const { error } = await g.supabase
    .from("department_members")
    .update({ left_on: new Date().toISOString().slice(0, 10) })
    .eq("id", id.data)
    .eq("church_id", g.churchId);
  if (error) return fail(error, "update department membership");
  revalidatePath("/members", "layout");
  revalidatePath("/departments", "layout");
  return { ok: true, message: "Removed from department (history kept)" };
}
