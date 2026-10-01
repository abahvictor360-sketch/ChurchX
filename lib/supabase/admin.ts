import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseSecretKey, supabaseUrl } from "@/lib/env";

/**
 * Service-role client. BYPASSES RLS — use only on the server, only for
 * operations that require it (auth.admin invitations), and only after the
 * caller's permission has been verified with their own session.
 */
export function createAdminClient() {
  return createClient<Database>(supabaseUrl(), supabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
