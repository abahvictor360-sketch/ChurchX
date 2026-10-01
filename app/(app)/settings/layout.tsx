import { requireChurch } from "@/lib/auth/context";
import { hasAny } from "@/lib/permissions";
import { PageHeader } from "@/components/app/page-header";
import { SettingsNav } from "@/features/church/settings-nav";
import { SETTINGS_SECTIONS } from "@/features/church/settings-sections";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireChurch();
  const items = SETTINGS_SECTIONS.filter((s) => hasAny(ctx.permissions, s.any)).map(({ href, label }) => ({ href, label }));
  return (
    <>
      <PageHeader title="Settings" crumbs={[{ label: "Settings" }]} />
      <SettingsNav items={[{ href: "/settings", label: "Overview" }, ...items]} />
      {children}
    </>
  );
}
