"use server";

import { z } from "zod";
import { guard } from "@/lib/auth/action";

export type PersonOption = { id: string; kind: "member" | "visitor"; name: string; detail: string | null };

const schema = z.object({ q: z.string().max(80), kind: z.enum(["all", "member", "visitor"]) });

/** Contact-free people lookup for pickers. Permission checked in the database. */
export async function searchPeople(q: string, kind: "all" | "member" | "visitor" = "all"): Promise<PersonOption[]> {
  const parsed = schema.safeParse({ q, kind });
  if (!parsed.success) return [];
  const g = await guard();
  if (!g.ok) return [];
  const { data, error } = await g.supabase.rpc("lookup_people", {
    p_church: g.churchId,
    p_query: parsed.data.q,
    p_kind: parsed.data.kind,
    p_limit: 12,
  });
  if (error || !data) return [];
  return data
    .filter((r) => r.id && r.full_name)
    .map((r) => ({
      id: r.id!,
      kind: r.kind === "visitor" ? "visitor" : "member",
      name: r.full_name!,
      detail: r.kind === "visitor" ? "Visitor" : (r.membership_number ?? null),
    }));
}
