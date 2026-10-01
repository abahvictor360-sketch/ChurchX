"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard } from "@/lib/auth/action";
import { fail, type ActionResult } from "@/lib/actions";
import { ATTENDANCE_STATUSES } from "@/lib/validation";

export type CheckinPerson = {
  id: string;
  kind: "member" | "visitor";
  name: string;
  number: string | null;
  attendanceId: string | null;
  status: string | null;
};

export async function searchCheckin(serviceId: string, query: string, offset = 0): Promise<{ people: CheckinPerson[]; total: number }> {
  const parsed = z.object({ s: z.uuid(), q: z.string().max(80), o: z.number().int().min(0).max(100000) }).safeParse({ s: serviceId, q: query, o: offset });
  if (!parsed.success) return { people: [], total: 0 };
  const g = await guard("attendance.record", "attendance.correct");
  if (!g.ok) return { people: [], total: 0 };
  const { data, error } = await g.supabase.rpc("checkin_search", { p_service: parsed.data.s, p_query: parsed.data.q, p_limit: 30, p_offset: parsed.data.o });
  if (error || !data) return { people: [], total: 0 };
  return {
    total: Number(data[0]?.total_count ?? 0),
    people: data
      .filter((r) => r.person_id && r.full_name)
      .map((r) => ({
        id: r.person_id!,
        kind: r.kind === "visitor" ? "visitor" : "member",
        name: r.full_name!,
        number: r.membership_number,
        attendanceId: r.attendance_id,
        status: r.attendance_status,
      })),
  };
}

export async function checkIn(serviceId: string, personId: string, kind: "member" | "visitor"): Promise<ActionResult<{ attendanceId: string }>> {
  const g = await guard("attendance.record");
  if (!g.ok) return g.result;
  const parsed = z.object({ s: z.uuid(), p: z.uuid(), k: z.enum(["member", "visitor"]) }).safeParse({ s: serviceId, p: personId, k: kind });
  if (!parsed.success) return { ok: false, error: "Invalid check-in." };
  const { data, error } = await g.supabase
    .from("attendance")
    .insert({
      church_id: g.churchId,
      service_id: parsed.data.s,
      member_id: parsed.data.k === "member" ? parsed.data.p : null,
      visitor_id: parsed.data.k === "visitor" ? parsed.data.p : null,
      status: "present",
      method: "manual",
    })
    .select("id")
    .single();
  if (error?.code === "23505") return { ok: false, error: "Already checked in for this service." };
  if (error || !data) return fail(error, "check in");
  return { ok: true, data: { attendanceId: data.id } };
}

export async function bulkMark(serviceId: string, memberIds: string[], status: string): Promise<ActionResult> {
  const g = await guard("attendance.record");
  if (!g.ok) return g.result;
  const parsed = z
    .object({ s: z.uuid(), ids: z.array(z.uuid()).min(1, "Select at least one person").max(1000), status: z.enum(ATTENDANCE_STATUSES) })
    .safeParse({ s: serviceId, ids: memberIds, status });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid selection." };
  const { data, error } = await g.supabase.rpc("bulk_mark_attendance", { p_service: parsed.data.s, p_member_ids: parsed.data.ids, p_status: parsed.data.status });
  if (error) return fail(error, "record attendance");
  revalidatePath(`/attendance/${parsed.data.s}`);
  const skipped = parsed.data.ids.length - (data ?? 0);
  return { ok: true, message: `Marked ${data} ${parsed.data.status}${skipped ? ` · ${skipped} already recorded` : ""}` };
}

/** Corrections update the existing record (never delete). RLS: attendance.correct, or the recorder within 12h. */
export async function correctAttendance(attendanceId: string, status: string, notes?: string): Promise<ActionResult> {
  const g = await guard("attendance.record", "attendance.correct");
  if (!g.ok) return g.result;
  const parsed = z.object({ id: z.uuid(), status: z.enum(ATTENDANCE_STATUSES), notes: z.string().max(500).optional() }).safeParse({ id: attendanceId, status, notes });
  if (!parsed.success) return { ok: false, error: "Invalid correction." };
  const { data, error } = await g.supabase
    .from("attendance")
    .update({ status: parsed.data.status, ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || null } : {}) })
    .eq("id", parsed.data.id)
    .select("service_id");
  if (error) return fail(error, "correct attendance");
  if (!data?.length) return { ok: false, error: "You can only correct records you made in the last 12 hours. Ask an administrator." };
  revalidatePath(`/attendance/${data[0].service_id}`);
  return { ok: true, message: `Marked ${parsed.data.status}` };
}

export type AttendanceEntry = { id: string; kind: string; personId: string; name: string; number: string | null; status: string; checkedInAt: string; method: string };

export async function listServiceAttendance(serviceId: string): Promise<AttendanceEntry[]> {
  const id = z.uuid().safeParse(serviceId);
  if (!id.success) return [];
  const g = await guard("attendance.record", "attendance.view");
  if (!g.ok) return [];
  const { data } = await g.supabase.rpc("service_attendance_list", { p_service: id.data });
  return (data ?? []).map((r) => ({
    id: r.attendance_id!,
    kind: r.kind ?? "member",
    personId: r.person_id!,
    name: r.full_name ?? "Unknown",
    number: r.membership_number,
    status: r.status ?? "present",
    checkedInAt: r.checked_in_at ?? "",
    method: r.method ?? "manual",
  }));
}
