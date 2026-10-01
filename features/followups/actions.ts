"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard } from "@/lib/auth/action";
import { fail, invalid, type ActionResult } from "@/lib/actions";
import { assignFollowupSchema, completeFollowupSchema, formToObject } from "@/lib/validation";

export async function assignFollowups(input: {
  assignee: string;
  member_ids?: string[];
  visitor_ids?: string[];
  due_date: string;
  notes?: string | null;
  care_alert_id?: string | null;
}): Promise<ActionResult> {
  const g = await guard("followups.manage");
  if (!g.ok) return g.result;
  const parsed = assignFollowupSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const { data, error } = await g.supabase.rpc("assign_followups", {
    p_church: g.churchId,
    p_assignee: v.assignee,
    p_member_ids: v.member_ids,
    p_visitor_ids: v.visitor_ids,
    p_due: v.due_date,
    p_notes: v.notes ?? undefined,
    p_care_alert: v.care_alert_id ?? undefined,
  });
  if (error) return fail(error, "assign follow-up");
  revalidatePath("/followups");
  revalidatePath("/care");
  return { ok: true, message: `Assigned ${data} follow-up${data === 1 ? "" : "s"}` };
}

export async function completeFollowup(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard();
  if (!g.ok) return g.result;
  const parsed = completeFollowupSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  if (v.next_followup_date && v.next_followup_date < new Date().toISOString().slice(0, 10)) {
    return { ok: false, error: "Please check the form.", fieldErrors: { next_followup_date: "Next follow-up must be today or later" } };
  }
  const { error } = await g.supabase.rpc("complete_followup", {
    p_followup: v.followup_id,
    p_contact_method: v.contact_method,
    p_outcome: v.outcome,
    p_notes: v.notes ?? undefined,
    p_next_date: v.next_followup_date ?? undefined,
    p_visitor_status: v.visitor_status ?? undefined,
  });
  if (error) return fail(error, "record the follow-up");
  revalidatePath("/followups");
  revalidatePath("/care");
  revalidatePath("/visitors", "layout");
  revalidatePath("/members", "layout");
  return { ok: true, message: v.next_followup_date ? "Follow-up recorded and next one scheduled" : "Follow-up recorded" };
}

export async function cancelFollowup(id: string): Promise<ActionResult> {
  const g = await guard("followups.manage");
  if (!g.ok) return g.result;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid follow-up." };
  const { error } = await g.supabase.from("followups").update({ status: "cancelled" }).eq("id", parsed.data).eq("status", "pending");
  if (error) return fail(error);
  revalidatePath("/followups");
  return { ok: true, message: "Follow-up cancelled" };
}

export async function reassignFollowup(id: string, assignee: string, dueDate: string): Promise<ActionResult> {
  const g = await guard("followups.manage");
  if (!g.ok) return g.result;
  const parsed = z.object({ id: z.uuid(), assignee: z.uuid(), due: z.iso.date() }).safeParse({ id, assignee, due: dueDate });
  if (!parsed.success) return { ok: false, error: "Please choose a worker and date." };
  const { error } = await g.supabase
    .from("followups")
    .update({ assigned_to: parsed.data.assignee, due_date: parsed.data.due })
    .eq("id", parsed.data.id)
    .eq("status", "pending");
  if (error) return fail(error, "reassign");
  revalidatePath("/followups");
  return { ok: true, message: "Follow-up reassigned" };
}
