import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasAny, isPermission, type Permission } from "@/lib/permissions";

export const CHURCH_COOKIE = "cx_church";

export type ChurchSummary = {
  id: string;
  name: string;
  logo_path: string | null;
  currency: string;
  timezone: string;
  country: string | null;
  onboarding_completed_at: string | null;
};

export type ChurchContext = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: string;
  isSuperAdmin: boolean;
  church: ChurchSummary;
  churches: { id: string; name: string; role: string }[];
  permissions: Set<Permission>;
  memberId: string | null;
  can: (...perms: Permission[]) => boolean;
};

/** Verified user id from the session JWT (or null). Cached per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub as string, email: (claims.email as string | undefined) ?? null };
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Resolves the active church for the signed-in user. The cookie only selects
 * among churches the user actually belongs to — it is never trusted on its own.
 * Cached per request.
 */
export const getChurchContext = cache(async (): Promise<ChurchContext | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();

  const [{ data: memberships }, { data: profile }] = await Promise.all([
    supabase
      .from("church_users")
      .select("church_id, role, member_id, churches(id, name, logo_path, currency, timezone, country, onboarding_completed_at)")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase.from("profiles").select("full_name, is_super_admin").eq("id", user.id).maybeSingle(),
  ]);

  const isSuperAdmin = Boolean(profile?.is_super_admin);
  const list = (memberships ?? []).filter((m) => m.churches);
  let churchOptions = list.map((m) => ({ id: m.church_id, name: m.churches!.name, role: m.role }));

  const cookieStore = await cookies();
  const selected = cookieStore.get(CHURCH_COOKIE)?.value;

  const active = list.find((m) => m.church_id === selected) ?? (isSuperAdmin && selected ? undefined : list[0]);
  let church: ChurchSummary | null = active?.churches ?? null;
  let role = active?.role ?? "";

  if (isSuperAdmin) {
    // Super admins may open any church (RLS grants them access platform-wide).
    const { data: all } = await supabase
      .from("churches")
      .select("id, name, logo_path, currency, timezone, country, onboarding_completed_at")
      .order("name")
      .limit(200);
    const others = (all ?? []).filter((c) => !list.some((m) => m.church_id === c.id));
    churchOptions = [...churchOptions, ...others.map((c) => ({ id: c.id, name: c.name, role: "super_admin" }))];
    if (!church) {
      church = (all ?? []).find((c) => c.id === selected) ?? list[0]?.churches ?? all?.[0] ?? null;
      role = list.find((m) => m.church_id === church?.id)?.role ?? "super_admin";
    }
  }

  if (!church) return null;

  const { data: perms } = await supabase.rpc("my_permissions", { p_church: church.id });
  const permissions = new Set<Permission>((perms ?? []).filter(isPermission));

  return {
    userId: user.id,
    email: user.email,
    fullName: profile?.full_name ?? null,
    role,
    isSuperAdmin,
    church,
    churches: churchOptions,
    permissions,
    memberId: active?.member_id ?? null,
    can: (...p: Permission[]) => hasAny(permissions, p),
  };
});

/** For pages: requires sign-in and a church (else onboarding). */
export async function requireChurch(...anyOf: Permission[]) {
  await requireUser();
  const ctx = await getChurchContext();
  if (!ctx) redirect("/onboarding");
  if (anyOf.length && !ctx.can(...anyOf)) redirect("/no-access");
  return ctx;
}
