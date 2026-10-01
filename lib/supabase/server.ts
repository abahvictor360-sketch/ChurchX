import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

/**
 * Supabase client bound to the current user's session (RLS applies).
 * Create one per request — never share between requests.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
