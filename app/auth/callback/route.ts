import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/features/auth/safe-next";

/** PKCE code exchange (used by magic links / OAuth when enabled later). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await supabase.rpc("accept_invitations");
      return NextResponse.redirect(new URL(next, origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", origin));
}
