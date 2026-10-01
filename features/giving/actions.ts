"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard } from "@/lib/auth/action";
import { fail, invalid, type ActionResult } from "@/lib/actions";
import { categorySchema, contributionSchema, formToObject, voidContributionSchema } from "@/lib/validation";

export async function saveContribution(id: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard("giving.manage");
  if (!g.ok) return g.result;
  const raw = formToObject(formData);
  const parsed = contributionSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  if (!v.member_id && !v.is_anonymous && !v.contributor_name) {
    return { ok: false, error: "Please check the form.", fieldErrors: { member_id: "Choose a member, enter a name, or tick Anonymous" } };
  }
  const payload = { ...v, member_id: v.is_anonymous ? null : v.member_id, contributor_name: v.is_anonymous || v.member_id ? null : v.contributor_name };
  if (id) {
    const { error } = await g.supabase.from("contributions").update(payload).eq("id", z.uuid().parse(id)).eq("church_id", g.churchId).eq("status", "recorded");
    if (error) return fail(error, "save the contribution");
  } else {
    // currency is set from church settings by the database
    const { error } = await g.supabase.from("contributions").insert({ ...payload, church_id: g.churchId, currency: g.ctx.church.currency });
    if (error) return fail(error, "record the contribution");
  }
  revalidatePath("/giving");
  revalidatePath("/reports/finance");
  return { ok: true, message: id ? "Contribution updated" : "Contribution recorded" };
}

export async function voidContribution(id: string, reason: string): Promise<ActionResult> {
  const g = await guard("giving.manage");
  if (!g.ok) return g.result;
  const parsed = voidContributionSchema.safeParse({ id, reason });
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await g.supabase
    .from("contributions")
    .update({ status: "voided", void_reason: parsed.data.reason, voided_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("church_id", g.churchId)
    .eq("status", "recorded");
  if (error) return fail(error, "void the contribution");
  revalidatePath("/giving", "layout");
  revalidatePath("/reports/finance");
  return { ok: true, message: "Contribution voided (kept in history)" };
}

export async function saveCategory(id: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard("church.manage");
  if (!g.ok) return g.result;
  const parsed = categorySchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const res = id
    ? await g.supabase.from("giving_categories").update(parsed.data).eq("id", z.uuid().parse(id)).eq("church_id", g.churchId)
    : await g.supabase.from("giving_categories").insert({ ...parsed.data, church_id: g.churchId });
  if (res.error?.code === "23505") return { ok: false, error: "A category with this name exists.", fieldErrors: { name: "Name already in use" } };
  if (res.error) return fail(res.error, "save the category");
  revalidatePath("/settings/giving");
  return { ok: true, message: "Category saved" };
}
