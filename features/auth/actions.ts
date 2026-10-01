"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
import { passwordSchema } from "@/lib/validation";
import { fieldErrorsFrom, type ActionResult } from "@/lib/actions";
import { safeNext } from "@/features/auth/safe-next";

const email = z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email("Enter a valid email address"));

export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Enter your password"), next: z.string().optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Please check the form.", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { ok: false, error: "Please confirm your email address first — check your inbox for the link." };
    }
    return { ok: false, error: "Incorrect email or password." };
  }
  // Activates any pending church invitations for this account.
  await supabase.rpc("accept_invitations");
  redirect(safeNext(parsed.data.next));
}

export async function signUp(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, "Enter your full name").max(120),
      email,
      password: passwordSchema,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Please check the form.", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${siteUrl()}/auth/confirm?next=/onboarding`,
    },
  });
  if (error) {
    if (error.code === "weak_password") return { ok: false, error: "Please choose a stronger password." };
    if (error.code === "over_email_send_rate_limit") return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
    console.error("[auth] sign up failed", error.code);
    return { ok: false, error: "We couldn't create your account. Please try again." };
  }
  if (data.session) redirect("/onboarding");
  return { ok: true, message: "Check your email for a confirmation link to activate your account." };
}

export async function requestPasswordReset(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Please check the form.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/reset-password`,
  });
  if (error && error.code === "over_email_send_rate_limit") {
    return { ok: false, error: "Too many requests. Please wait a few minutes and try again." };
  }
  // Same response whether or not the account exists (prevents email enumeration).
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Please check the form.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "Your reset link has expired. Please request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { ok: false, error: "Choose a password different from your current one." };
    return { ok: false, error: "We couldn't update your password. Please request a new link." };
  }
  await supabase.rpc("accept_invitations");
  redirect("/dashboard");
}
