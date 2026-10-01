import "server-only";
import { getChurchContext, type ChurchContext } from "@/lib/auth/context";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions";
import type { Permission } from "@/lib/permissions";

type Guard =
  | { ok: true; ctx: ChurchContext; supabase: ServerSupabase; churchId: string }
  | { ok: false; result: ActionResult<never> };

/**
 * Every Server Action starts here: resolves the signed-in user's church from
 * the session (never from the request body) and checks permissions. The
 * returned client uses the user's session, so RLS is enforced as well.
 */
export async function guard(...anyOf: Permission[]): Promise<Guard> {
  const ctx = await getChurchContext();
  if (!ctx) return { ok: false, result: { ok: false, error: "Your session has expired. Please sign in again." } };
  if (anyOf.length && !ctx.can(...anyOf)) {
    return { ok: false, result: { ok: false, error: "You do not have permission to do this." } };
  }
  const supabase = await createClient();
  return { ok: true, ctx, supabase, churchId: ctx.church.id };
}
