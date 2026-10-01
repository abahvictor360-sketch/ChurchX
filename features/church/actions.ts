"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { guard } from "@/lib/auth/action";
import { CHURCH_COOKIE, getUser } from "@/lib/auth/context";
import { careRulesSchema, churchProfileSchema, formToObject, onboardingSchema } from "@/lib/validation";
import { fail, invalid, type ActionResult } from "@/lib/actions";

export async function createChurch(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Your session has expired. Please sign in again." };
  const parsed = onboardingSchema.safeParse(formToObject(formData, ["service_days"]));
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_church", {
    p_name: v.name,
    p_country: v.country ?? undefined,
    p_state: v.state ?? undefined,
    p_city: v.city ?? undefined,
    p_address: v.address ?? undefined,
    p_phone: v.phone ?? undefined,
    p_email: v.email ?? undefined,
    p_website: v.website ?? undefined,
    p_timezone: v.timezone,
    p_currency: v.currency,
    p_service_days: v.service_days.length ? v.service_days : [0],
  });
  if (error || !data) return fail(error, "create your church");
  const store = await cookies();
  store.set(CHURCH_COOKIE, data, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 31536000 });
  return { ok: true, data: { id: data } };
}

/** Saves an uploaded logo path (upload itself happens in the browser via RLS-protected storage). */
export async function setChurchLogo(path: string | null): Promise<ActionResult> {
  const g = await guard("church.manage");
  if (!g.ok) return g.result;
  if (path !== null && (!path.startsWith(`${g.churchId}/`) || path.length > 300)) return { ok: false, error: "Invalid file." };
  const { error } = await g.supabase.from("churches").update({ logo_path: path }).eq("id", g.churchId);
  if (error) return fail(error, "save the logo");
  revalidatePath("/", "layout");
  return { ok: true, message: path ? "Logo updated" : "Logo removed" };
}

export async function completeOnboarding(): Promise<ActionResult> {
  const g = await guard("church.manage");
  if (!g.ok) return g.result;
  const { error } = await g.supabase.from("churches").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", g.churchId);
  return error ? fail(error) : { ok: true };
}

export async function updateChurchProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard("church.manage");
  if (!g.ok) return g.result;
  const parsed = churchProfileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await g.supabase
    .from("churches")
    .update({ ...parsed.data, onboarding_completed_at: g.ctx.church.onboarding_completed_at ?? new Date().toISOString() })
    .eq("id", g.churchId);
  if (error) return fail(error, "save church details");
  revalidatePath("/", "layout");
  return { ok: true, message: "Church profile saved" };
}

export async function updateServiceDays(days: number[]): Promise<ActionResult> {
  const g = await guard("church.manage");
  if (!g.ok) return g.result;
  const parsed = z.array(z.number().int().min(0).max(6)).max(7).safeParse(days);
  if (!parsed.success) return { ok: false, error: "Invalid days" };
  const { error } = await g.supabase.from("church_settings").update({ default_service_days: [...new Set(parsed.data)].sort() }).eq("church_id", g.churchId);
  return error ? fail(error) : { ok: true, message: "Service days saved" };
}

export async function updateMemberPrefix(prefix: string): Promise<ActionResult> {
  const g = await guard("church.manage");
  if (!g.ok) return g.result;
  const parsed = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,8}$/, "Use 1–8 letters or numbers").safeParse(prefix);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { error } = await g.supabase.from("church_settings").update({ member_number_prefix: parsed.data }).eq("church_id", g.churchId);
  return error ? fail(error) : { ok: true, message: "Membership number prefix saved" };
}

export async function updateCareRules(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard("church.manage");
  if (!g.ok) return g.result;
  const parsed = careRulesSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await g.supabase.from("church_settings").update({ care_rules: parsed.data }).eq("church_id", g.churchId);
  if (error) return fail(error, "save rules");
  await g.supabase.rpc("refresh_member_care", { p_church: g.churchId, p_force: true });
  revalidatePath("/care");
  return { ok: true, message: "Member care rules saved and alerts recalculated" };
}
