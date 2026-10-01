"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { guard } from "@/lib/auth/action";
import { CHURCH_COOKIE, getChurchContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions";

export async function switchChurch(churchId: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(churchId);
  const ctx = await getChurchContext();
  // Only allow switching to churches the user can actually access.
  if (!id.success || !ctx?.churches.some((c) => c.id === id.data)) {
    return { ok: false, error: "You do not have access to that church." };
  }
  const store = await cookies();
  store.set(CHURCH_COOKIE, id.data, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const store = await cookies();
  store.delete(CHURCH_COOKIE);
  redirect("/login");
}

export type SearchResult = { kind: string; id: string; title: string; subtitle: string; href: string };

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = z.string().trim().min(2).max(80).safeParse(query);
  if (!q.success) return [];
  const g = await guard();
  if (!g.ok) return [];
  // SECURITY INVOKER function: results are filtered by RLS for this user.
  const { data, error } = await g.supabase.rpc("global_search", { p_church: g.churchId, p_query: q.data });
  if (error || !data) return [];
  return data
    .filter((r) => r.id && r.title && r.href)
    .map((r) => ({ kind: r.kind ?? "", id: r.id!, title: r.title!, subtitle: r.subtitle ?? "", href: r.href! }));
}

export type NotificationItem = { id: string; title: string; body: string | null; link: string | null; type: string; read_at: string | null; created_at: string };

export async function getNotifications(limit = 8): Promise<{ items: NotificationItem[]; unread: number }> {
  const g = await guard();
  if (!g.ok) return { items: [], unread: 0 };
  const [{ data }, { count }] = await Promise.all([
    g.supabase
      .from("notifications")
      .select("id, title, body, link, type, read_at, created_at")
      .eq("church_id", g.churchId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 50)),
    g.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("church_id", g.churchId)
      .is("read_at", null),
  ]);
  return { items: data ?? [], unread: count ?? 0 };
}

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const g = await guard();
  if (!g.ok) return g.result;
  let q = g.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("church_id", g.churchId).is("read_at", null);
  if (ids?.length) {
    const parsed = z.array(z.uuid()).max(100).safeParse(ids);
    if (!parsed.success) return { ok: false, error: "Invalid request" };
    q = q.in("id", parsed.data);
  }
  const { error } = await q;
  return error ? { ok: false, error: "Could not update notifications." } : { ok: true };
}
