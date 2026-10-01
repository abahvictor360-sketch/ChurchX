import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/features/auth/safe-next";

const TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Handles links from Supabase auth emails (confirm sign-up, invitation,
 * password recovery). Email templates must point to:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next=<path>
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const defaultNext = type === "recovery" || type === "invite" ? "/reset-password" : "/dashboard";
  const next = safeNext(searchParams.get("next"), defaultNext);

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      await supabase.rpc("accept_invitations");
      return NextResponse.redirect(new URL(type === "invite" ? "/reset-password?welcome=1" : next, origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", origin));
}
