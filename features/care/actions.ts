"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard } from "@/lib/auth/action";
import { fail, type ActionResult } from "@/lib/actions";

export async function resolveCareAlert(id: string, note: string): Promise<ActionResult> {
  const g = await guard("care.manage");
  if (!g.ok) return g.result;
  const parsed = z.object({ id: z.uuid(), note: z.string().trim().max(1000) }).safeParse({ id, note });
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { error } = await g.supabase
    .from("member_care_alerts")
    .update({ status: "resolved", resolution_note: parsed.data.note || null })
    .eq("id", parsed.data.id)
    .eq("status", "open");
  if (error) return fail(error, "resolve the alert");
  revalidatePath("/care");
  revalidatePath("/dashboard");
  return { ok: true, message: "Marked as resolved" };
}

export async function refreshCare(): Promise<ActionResult> {
  const g = await guard("care.view");
  if (!g.ok) return g.result;
  const { error } = await g.supabase.rpc("refresh_member_care", { p_church: g.churchId, p_force: true });
  if (error) return fail(error, "refresh alerts");
  revalidatePath("/care");
  return { ok: true, message: "Alerts recalculated" };
}
