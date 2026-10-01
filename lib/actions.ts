import type { ZodError } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const initialState: ActionResult<unknown> | null = null;

/** Maps Zod issues to { field: firstMessage }. */
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function invalid(error: ZodError): ActionResult<never> {
  return { ok: false, error: "Please correct the highlighted fields.", fieldErrors: fieldErrorsFrom(error) };
}

type PgLikeError = { code?: string; message?: string; details?: string | null; hint?: string | null };

/**
 * Converts a database/PostgREST error into a message that is safe to show to
 * church workers. Raw database errors are logged server-side (without row
 * data), never returned to the browser.
 */
export function friendlyError(error: PgLikeError | null | undefined, context = "save"): string {
  if (!error) return `Could not ${context}. Please try again.`;
  const code = error.code ?? "";
  // Messages raised intentionally by our own functions (P0001/P0002/22023) are user-facing.
  if (["P0001", "P0002", "22023"].includes(code) && error.message) return error.message;
  console.error(`[db] ${context} failed`, { code, message: error.message?.slice(0, 200) });
  switch (code) {
    case "23505":
      return "This record already exists.";
    case "23503":
      return "A related record could not be found. Please refresh and try again.";
    case "23514":
      return "Some values are not valid. Please check the form.";
    case "42501":
    case "PGRST301":
      return "You do not have permission to do this.";
    case "PGRST116":
      return "Record not found.";
    default:
      return `Could not ${context}. Please try again.`;
  }
}

export function fail(error: PgLikeError | null | undefined, context?: string): ActionResult<never> {
  return { ok: false, error: friendlyError(error, context) };
}

export function denied(): ActionResult<never> {
  return { ok: false, error: "You do not have permission to do this." };
}
