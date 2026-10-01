"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guard } from "@/lib/auth/action";
import { memberSchema } from "@/lib/validation";
import { normalizeDate, normalizeGender, normalizeStatus } from "@/lib/import";
import type { ActionResult } from "@/lib/actions";

export type ImportSummary = { inserted: number; skipped: number; errors: { row: number; message: string }[] };

const MAX_ROWS = 2000;

export async function importMembers(rows: Record<string, string>[], skipDuplicates: boolean): Promise<ActionResult<ImportSummary>> {
  const g = await guard("data.import");
  if (!g.ok) return g.result;
  if (!g.ctx.can("members.manage")) return { ok: false, error: "You need permission to add members." };
  const parsedRows = z.array(z.record(z.string(), z.string())).max(MAX_ROWS, `Import at most ${MAX_ROWS} rows at a time`).safeParse(rows);
  if (!parsedRows.success) return { ok: false, error: parsedRows.error.issues[0]?.message ?? "Invalid file" };

  const schema = memberSchema(g.ctx.church.country);
  const errors: ImportSummary["errors"] = [];
  const valid: { row: number; data: z.infer<typeof schema> }[] = [];
  const today = new Date().toISOString().slice(0, 10);

  parsedRows.data.forEach((raw, i) => {
    const row = i + 2; // header is row 1
    const dob = normalizeDate(raw.date_of_birth);
    const join = normalizeDate(raw.join_date);
    const gender = normalizeGender(raw.gender);
    const status = normalizeStatus(raw.membership_status);
    if (dob === undefined) return errors.push({ row, message: `Unrecognised date of birth "${raw.date_of_birth}" (use DD/MM/YYYY)` });
    if (join === undefined) return errors.push({ row, message: `Unrecognised join date "${raw.join_date}"` });
    if (gender === undefined) return errors.push({ row, message: `Unrecognised gender "${raw.gender}"` });
    if (status === undefined) return errors.push({ row, message: `Unrecognised status "${raw.membership_status}"` });
    const result = schema.safeParse({
      ...raw,
      date_of_birth: dob,
      join_date: join ?? today,
      gender,
      membership_status: status,
      marital_status: raw.marital_status?.toLowerCase(),
    });
    if (!result.success) {
      const issue = result.error.issues[0];
      return errors.push({ row, message: `${issue.path.join(".") || "row"}: ${issue.message}` });
    }
    valid.push({ row, data: result.data });
  });

  let skipped = 0;
  let toInsert = valid;
  if (skipDuplicates && valid.length) {
    const phones = [...new Set(valid.map((v) => v.data.phone).filter((p): p is string => Boolean(p)))];
    const emails = [...new Set(valid.map((v) => v.data.email).filter((e): e is string => Boolean(e)))];
    const existingPhones = new Set<string>();
    const existingEmails = new Set<string>();
    for (let i = 0; i < phones.length; i += 300) {
      const { data } = await g.supabase.from("members").select("phone").eq("church_id", g.churchId).in("phone", phones.slice(i, i + 300));
      data?.forEach((d) => d.phone && existingPhones.add(d.phone));
    }
    for (let i = 0; i < emails.length; i += 300) {
      const { data } = await g.supabase.from("members").select("email").eq("church_id", g.churchId).in("email", emails.slice(i, i + 300));
      data?.forEach((d) => d.email && existingEmails.add(d.email));
    }
    const seen = new Set<string>();
    toInsert = valid.filter((v) => {
      const keys = [v.data.phone && `p:${v.data.phone}`, v.data.email && `e:${v.data.email}`].filter(Boolean) as string[];
      const dup = (v.data.phone && existingPhones.has(v.data.phone)) || (v.data.email && existingEmails.has(v.data.email)) || keys.some((k) => seen.has(k));
      keys.forEach((k) => seen.add(k));
      if (dup) skipped++;
      return !dup;
    });
  }

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200);
    const { error, count } = await g.supabase
      .from("members")
      .insert(batch.map((b) => ({ ...b.data, membership_number: b.data.membership_number ?? undefined, church_id: g.churchId })), { count: "exact" });
    if (error) {
      const message = error.code === "23505" ? "Duplicate membership number in this batch" : "Could not save this batch";
      batch.forEach((b) => errors.push({ row: b.row, message }));
    } else inserted += count ?? batch.length;
  }
  revalidatePath("/members");
  return { ok: true, data: { inserted, skipped, errors: errors.sort((a, b) => a.row - b.row).slice(0, 200) } };
}
