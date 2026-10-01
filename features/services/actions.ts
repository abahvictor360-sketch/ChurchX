"use server";

import { revalidatePath } from "next/cache";
import { addDays, format, parseISO } from "date-fns";
import { z } from "zod";
import { guard } from "@/lib/auth/action";
import { fail, invalid, type ActionResult } from "@/lib/actions";
import { formToObject, SERVICE_STATUSES, serviceSchema, serviceTypeSchema } from "@/lib/validation";
import { todayIn } from "@/lib/format";

export async function saveService(serviceId: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard("services.manage");
  if (!g.ok) return g.result;
  const parsed = serviceSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  if (serviceId) {
    const id = z.uuid().parse(serviceId);
    const { error } = await g.supabase.from("services").update(parsed.data).eq("id", id).eq("church_id", g.churchId);
    if (error) return fail(error, "save the service");
    revalidatePath(`/services/${id}`);
  } else {
    const { error } = await g.supabase.from("services").insert({ ...parsed.data, church_id: g.churchId });
    if (error) return fail(error, "create the service");
  }
  revalidatePath("/services");
  revalidatePath("/attendance");
  return { ok: true, message: serviceId ? "Service updated" : "Service scheduled" };
}

export async function setServiceStatus(id: string, status: string): Promise<ActionResult> {
  const g = await guard("services.manage");
  if (!g.ok) return g.result;
  const parsed = z.object({ id: z.uuid(), status: z.enum(SERVICE_STATUSES) }).safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "Invalid status." };
  const { error } = await g.supabase.from("services").update({ status: parsed.data.status }).eq("id", parsed.data.id).eq("church_id", g.churchId);
  if (error) return fail(error);
  revalidatePath("/services", "layout");
  revalidatePath("/attendance", "layout");
  return { ok: true, message: `Service marked ${parsed.data.status}` };
}

/** Creates services for the next N weeks from service types that have a default day. Skips existing ones. */
export async function generateServices(weeks: number): Promise<ActionResult> {
  const g = await guard("services.manage");
  if (!g.ok) return g.result;
  const n = z.number().int().min(1).max(12).safeParse(weeks);
  if (!n.success) return { ok: false, error: "Choose between 1 and 12 weeks." };
  const { data: types } = await g.supabase
    .from("service_types")
    .select("id, name, default_day, default_start_time, default_end_time")
    .eq("church_id", g.churchId)
    .eq("is_active", true)
    .not("default_day", "is", null);
  if (!types?.length) return { ok: false, error: "No service types have a default day. Set one in Settings → Service types." };
  const start = parseISO(todayIn(g.ctx.church.timezone));
  const end = addDays(start, n.data * 7 - 1);
  const { data: existing } = await g.supabase
    .from("services")
    .select("service_type_id, service_date")
    .eq("church_id", g.churchId)
    .gte("service_date", format(start, "yyyy-MM-dd"))
    .lte("service_date", format(end, "yyyy-MM-dd"));
  const have = new Set((existing ?? []).map((e) => `${e.service_type_id}|${e.service_date}`));
  const rows: { church_id: string; service_type_id: string; name: string; service_date: string; start_time: string | null; end_time: string | null }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const date = format(d, "yyyy-MM-dd");
    for (const t of types) {
      if (t.default_day === d.getDay() && !have.has(`${t.id}|${date}`)) {
        rows.push({ church_id: g.churchId, service_type_id: t.id, name: t.name, service_date: date, start_time: t.default_start_time, end_time: t.default_end_time });
      }
    }
  }
  if (rows.length) {
    const { error } = await g.supabase.from("services").insert(rows);
    if (error) return fail(error, "create services");
  }
  revalidatePath("/services");
  revalidatePath("/attendance");
  return { ok: true, message: rows.length ? `Scheduled ${rows.length} service${rows.length === 1 ? "" : "s"}` : "All services for that period already exist" };
}

export async function saveServiceType(id: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard("services.manage");
  if (!g.ok) return g.result;
  const parsed = serviceTypeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const res = id
    ? await g.supabase.from("service_types").update(parsed.data).eq("id", z.uuid().parse(id)).eq("church_id", g.churchId)
    : await g.supabase.from("service_types").insert({ ...parsed.data, church_id: g.churchId });
  if (res.error) return fail(res.error, "save the service type");
  revalidatePath("/settings/services");
  return { ok: true, message: "Service type saved" };
}

export async function toggleServiceType(id: string, active: boolean): Promise<ActionResult> {
  const g = await guard("services.manage");
  if (!g.ok) return g.result;
  const { error } = await g.supabase.from("service_types").update({ is_active: active }).eq("id", z.uuid().parse(id)).eq("church_id", g.churchId);
  if (error) return fail(error);
  revalidatePath("/settings/services");
  return { ok: true, message: active ? "Service type enabled" : "Service type disabled" };
}
