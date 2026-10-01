"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard } from "@/lib/auth/action";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";
import { fail, invalid, type ActionResult } from "@/lib/actions";
import { formToObject, inviteSchema, passwordSchema } from "@/lib/validation";
import { ROLES } from "@/lib/permissions";

const roleKeys = ROLES.map((r) => r.key) as [string, ...string[]];

/**
 * Invites a staff user. Permission is checked with the caller's own session
 * first; the service-role client is used ONLY for the auth.admin call, and
 * the church_users row is written with the caller's session (RLS enforced).
 */
export async function inviteUser(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard("users.manage");
  if (!g.ok) return g.result;
  const parsed = inviteSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Invitations are not configured: set SUPABASE_SECRET_KEY on the server." };
  }

  let userId: string | null = null;
  let existing = false;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(v.email, {
    data: { full_name: v.full_name ?? undefined },
    redirectTo: `${siteUrl()}/auth/confirm?next=/reset-password`,
  });
  if (invited?.user) {
    userId = invited.user.id;
  } else if (inviteError && (inviteError.code === "email_exists" || /already/i.test(inviteError.message))) {
    // Existing account: look it up and grant access to this church.
    const { data: profile } = await admin.from("profiles").select("id").eq("email", v.email).maybeSingle();
    userId = profile?.id ?? null;
    existing = true;
  } else if (inviteError) {
    console.error("[users] invite failed", inviteError.code);
    return { ok: false, error: inviteError.code === "over_email_send_rate_limit" ? "Email limit reached. Try again later." : "Could not send the invitation." };
  }
  if (!userId) return { ok: false, error: "Could not find or create that account." };

  const { data: current } = await g.supabase.from("church_users").select("id, status").eq("church_id", g.churchId).eq("user_id", userId).maybeSingle();
  if (current && current.status !== "disabled") return { ok: false, error: "This person already has access to your church." };
  const payload = {
    role: v.role,
    status: "invited",
    member_id: v.member_id,
    invited_email: v.email,
    invited_by: g.ctx.userId,
    invited_at: new Date().toISOString(),
  };
  const res = current
    ? await g.supabase.from("church_users").update({ role: v.role, status: "invited", member_id: v.member_id }).eq("id", current.id)
    : await g.supabase.from("church_users").insert({ ...payload, church_id: g.churchId, user_id: userId });
  if (res.error) return fail(res.error, "add the user");
  revalidatePath("/settings/users");
  return {
    ok: true,
    message: existing ? `${v.email} already has a ChurchX account. They'll get access the next time they sign in.` : `Invitation sent to ${v.email}`,
  };
}

export async function updateChurchUser(id: string, changes: { role?: string; status?: string; member_id?: string | null }): Promise<ActionResult> {
  const g = await guard("users.manage");
  if (!g.ok) return g.result;
  const parsed = z
    .object({
      id: z.uuid(),
      role: z.enum(roleKeys).optional(),
      status: z.enum(["active", "disabled"]).optional(),
      member_id: z.uuid().nullable().optional(),
    })
    .safeParse({ id, ...changes });
  if (!parsed.success) return { ok: false, error: "Invalid change." };
  const { id: rowId, ...update } = parsed.data;
  const { data, error } = await g.supabase.from("church_users").update(update).eq("id", rowId).eq("church_id", g.churchId).select("id");
  if (error) return fail(error, "update the user");
  if (!data?.length) return { ok: false, error: "User not found." };
  revalidatePath("/settings/users");
  return { ok: true, message: "User updated" };
}

export async function updateProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard();
  if (!g.ok) return g.result;
  const parsed = z
    .object({ full_name: z.string().trim().min(2, "Enter your name").max(120), phone: z.string().trim().max(30).optional() })
    .safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await g.supabase.from("profiles").update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null }).eq("id", g.ctx.userId);
  if (error) return fail(error, "save your profile");
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved" };
}

export async function changePassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard();
  if (!g.ok) return g.result;
  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] })
    .safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await g.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: error.code === "same_password" ? "Choose a different password." : "Could not change password." };
  return { ok: true, message: "Password changed" };
}
