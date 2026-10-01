"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shell/logo";
import { ChurchSwitcher } from "@/components/shell/church-switcher";

export type ShellProps = {
  allowed: string[];
  church: { id: string; name: string; logoUrl: string | null };
  churches: { id: string; name: string; role: string }[];
  user: { name: string; email: string | null; role: string };
};

export function isActive(pathname: string, href: string) {
  if (href === "/reports") return pathname === "/reports" || (pathname.startsWith("/reports/") && !pathname.startsWith("/reports/finance"));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ allowed, onNavigate }: { allowed: string[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const allowedSet = new Set(allowed);
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-5">
      {NAV.map((section) => {
        const items = section.items.filter((i) => allowedSet.has(`${section.label}:${i.href}`));
        if (!items.length) return null;
        return (
          <div key={section.label}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-sidebar-muted uppercase">{section.label}</p>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href + item.label}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-muted",
                        active && "bg-accent text-primary hover:bg-accent before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r before:bg-primary",
                      )}
                    >
                      <item.icon className={cn("size-[18px]", active ? "text-primary" : "text-sidebar-muted")} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar({ allowed, church, churches }: ShellProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-16 items-center border-b px-5">
        <Link href="/dashboard" aria-label="ChurchX home">
          <Logo />
        </Link>
      </div>
      <div className="border-b p-3">
        <ChurchSwitcher church={church} churches={churches} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <SidebarNav allowed={allowed} />
      </div>
      <p className="border-t px-5 py-3 text-xs text-sidebar-muted">© {new Date().getFullYear()} ChurchX</p>
    </aside>
  );
}
