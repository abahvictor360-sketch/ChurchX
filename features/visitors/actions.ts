"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { guard } from "@/lib/auth/action";
import { fail, invalid, type ActionResult } from "@/lib/actions";
import { formToObject, VISITOR_STATUSES, visitorSchema } from "@/lib/validation";

export async function saveVisitor(visitorId: string | null, _prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const g = visitorId ? await guard("visitors.manage") : await guard("visitors.create", "visitors.manage");
  if (!g.ok) return g.result;
  const raw = formToObject(formData);
  const parsed = visitorSchema(g.ctx.church.country).safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  if (visitorId) {
    const id = z.uuid().parse(visitorId);
    const { error } = await g.supabase.from("visitors").update(v).eq("id", id).eq("church_id", g.churchId);
    if (error) return fail(error, "save the visitor");
    revalidatePath(`/visitors/${id}`);
    redirect(`/visitors/${id}`);
  }

  // Duplicate check by phone among recent visitors and members.
  if (v.phone && raw.confirm_duplicate !== "on") {
    const [{ data: vis }, { data: mem }] = await Promise.all([
      g.supabase.from("visitors").select("full_name, visit_date").eq("church_id", g.churchId).eq("phone", v.phone).limit(1),
      g.supabase.from("members").select("full_name").eq("church_id", g.churchId).eq("phone", v.phone).limit(1),
    ]);
    const hit = mem?.[0] ? `${mem[0].full_name} (member)` : vis?.[0] ? `${vis[0].full_name} (visited ${vis[0].visit_date})` : null;
    if (hit) return { ok: false, error: "This phone number is already registered.", fieldErrors: { duplicate: `Same phone as ${hit}.` } };
  }

  const { data, error } = await g.supabase.from("visitors").insert({ ...v, church_id: g.churchId }).select("id").single();
  if (error || !data) return fail(error, "register the visitor");
  // Registering at a service counts as attending it.
  if (v.service_id && g.ctx.can("attendance.record")) {
    await g.supabase.from("attendance").insert({ church_id: g.churchId, service_id: v.service_id, visitor_id: data.id, status: "present" });
    revalidatePath(`/attendance/${v.service_id}`);
  }
  revalidatePath("/visitors");
  return { ok: true, data: { id: data.id }, message: `${v.first_name} has been registered. Welcome!` };
}

export async function setVisitorStatus(id: string, status: string): Promise<ActionResult> {
  const g = await guard();
  if (!g.ok) return g.result;
  const parsed = z.object({ id: z.uuid(), status: z.enum(VISITOR_STATUSES).exclude(["converted"]) }).safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "Invalid status." };
  // RLS: visitors.manage, or the follow-up worker assigned to this visitor.
  const { data, error } = await g.supabase.from("visitors").update({ status: parsed.data.status }).eq("id", parsed.data.id).neq("status", "converted").select("id");
  if (error) return fail(error, "update status");
  if (!data?.length) return { ok: false, error: "You do not have permission to update this visitor." };
  revalidatePath(`/visitors/${parsed.data.id}`);
  revalidatePath("/visitors");
  return { ok: true, message: "Status updated" };
}

const convertSchema = z.object({
  first_name: z.string().trim().max(80).optional(),
  last_name: z.string().trim().max(80).optional(),
  date_of_birth: z.union([z.iso.date(), z.literal("")]).optional(),
  membership_status: z.enum(["new_member", "active"]).default("new_member"),
  join_date: z.iso.date(),
});

export async function convertVisitor(visitorId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard("visitors.manage");
  if (!g.ok) return g.result;
  if (!g.ctx.can("members.manage")) return { ok: false, error: "You need permission to add members." };
  const id = z.uuid().safeParse(visitorId);
  const parsed = convertSchema.safeParse(formToObject(formData));
  if (!id.success || !parsed.success) return parsed.success ? { ok: false, error: "Invalid visitor." } : invalid(parsed.error);
  const { data, error } = await g.supabase.rpc("convert_visitor_to_member", { p_visitor: id.data, p_member: parsed.data });
  if (error || !data) return fail(error, "convert the visitor");
  revalidatePath("/visitors");
  revalidatePath("/members");
  redirect(`/members/${data}?created=1`);
}
