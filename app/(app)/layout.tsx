import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { NAV } from "@/lib/navigation";
import { hasAny } from "@/lib/permissions";
import { publicAssetUrl } from "@/lib/storage";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireChurch();
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("church_id", ctx.church.id)
    .is("read_at", null);

  const allowed = NAV.flatMap((s) => s.items.filter((i) => hasAny(ctx.permissions, i.any)).map((i) => `${s.label}:${i.href}`));

  return (
    <AppShell
      allowed={allowed}
      permissions={[...ctx.permissions]}
      unread={count ?? 0}
      church={{ id: ctx.church.id, name: ctx.church.name, logoUrl: publicAssetUrl(ctx.church.logo_path) }}
      churches={ctx.churches}
      user={{ name: ctx.fullName ?? ctx.email ?? "User", email: ctx.email, role: ctx.role }}
    >
      {children}
    </AppShell>
  );
}
