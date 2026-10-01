"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard } from "@/lib/auth/action";
import { fail, invalid, type ActionResult } from "@/lib/actions";
import { eventSchema, formToObject, registrationSchema } from "@/lib/validation";

export async function saveEvent(id: string | null, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard("events.manage");
  if (!g.ok) return g.result;
  const parsed = eventSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const res = id
    ? await g.supabase.from("events").update(parsed.data).eq("id", z.uuid().parse(id)).eq("church_id", g.churchId)
    : await g.supabase.from("events").insert({ ...parsed.data, church_id: g.churchId });
  if (res.error) return fail(res.error, "save the event");
  revalidatePath("/events", "layout");
  return { ok: true, message: id ? "Event updated" : "Event created" };
}

export async function registerForEvent(eventId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard("events.manage", "events.checkin");
  if (!g.ok) return g.result;
  const raw = formToObject(formData);
  const kind = raw.person_kind;
  const personId = typeof raw.person === "string" && raw.person ? raw.person : null;
  const parsed = registrationSchema(g.ctx.church.country).safeParse({
    member_id: kind === "member" ? personId : null,
    visitor_id: kind === "visitor" ? personId : null,
    guest_name: personId ? null : raw.guest_name,
    guest_phone: personId ? null : raw.guest_phone,
    guest_email: personId ? null : raw.guest_email,
  });
  if (!parsed.success) return invalid(parsed.error);
  const attended = raw.check_in_now === "on";
  const { error } = await g.supabase.from("event_registrations").insert({
    ...parsed.data,
    church_id: g.churchId,
    event_id: z.uuid().parse(eventId),
    attended,
    checked_in_at: attended ? new Date().toISOString() : null,
  });
  if (error?.code === "23505") return { ok: false, error: "This person is already registered." };
  if (error) return fail(error, "register");
  revalidatePath(`/events/${eventId}`);
  return { ok: true, message: attended ? "Registered and checked in" : "Registered" };
}

export async function setRegistrationAttended(id: string, attended: boolean): Promise<ActionResult> {
  const g = await guard("events.manage", "events.checkin");
  if (!g.ok) return g.result;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid registration." };
  const { data, error } = await g.supabase
    .from("event_registrations")
    .update({ attended, checked_in_at: attended ? new Date().toISOString() : null })
    .eq("id", parsed.data)
    .select("event_id")
    .single();
  if (error || !data) return fail(error, "update check-in");
  revalidatePath(`/events/${data.event_id}`);
  return { ok: true, message: attended ? "Checked in" : "Check-in undone" };
}

export async function cancelRegistration(id: string): Promise<ActionResult> {
  const g = await guard("events.manage", "events.checkin");
  if (!g.ok) return g.result;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid registration." };
  const { data, error } = await g.supabase.from("event_registrations").update({ status: "cancelled", attended: false }).eq("id", parsed.data).select("event_id").single();
  if (error || !data) return fail(error, "cancel registration");
  revalidatePath(`/events/${data.event_id}`);
  return { ok: true, message: "Registration cancelled" };
}
