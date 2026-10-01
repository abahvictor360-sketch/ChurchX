import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { hasAny } from "@/lib/permissions";
import { SETTINGS_SECTIONS } from "@/features/church/settings-sections";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireChurch();
  const sections = SETTINGS_SECTIONS.filter((s) => hasAny(ctx.permissions, s.any));
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sections.map((s) => (
        <li key={s.href}>
          <Link href={s.href} className="block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <Card className="h-full flex-row items-center justify-between gap-3 p-5 transition-shadow hover:shadow-md">
              <span>
                <span className="block font-semibold">{s.label}</span>
                <span className="block text-sm text-muted-foreground">{s.description}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Card>
          </Link>
        </li>
      ))}
      <li>
        <Link href="/departments" className="block h-full rounded-lg">
          <Card className="h-full flex-row items-center justify-between gap-3 p-5 transition-shadow hover:shadow-md">
            <span>
              <span className="block font-semibold">Departments</span>
              <span className="block text-sm text-muted-foreground">Manage departments, leaders and members.</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Card>
        </Link>
      </li>
    </ul>
  );
}
