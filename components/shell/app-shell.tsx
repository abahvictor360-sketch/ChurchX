"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, Home, Menu, PhoneCall, Plus, Search, UserPlus, Users, HandCoins, Church } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CommandSearch, SearchTrigger, useCommandSearch } from "@/components/shell/command-search";
import { Logo } from "@/components/shell/logo";
import { NotificationsBell } from "@/components/shell/notifications-bell";
import { Sidebar, SidebarNav, isActive, type ShellProps } from "@/components/shell/sidebar";
import { ChurchSwitcher } from "@/components/shell/church-switcher";
import { UserMenu } from "@/components/shell/user-menu";
import { cn } from "@/lib/utils";

type QuickAction = { href: string; label: string; perm: string };
const QUICK: (QuickAction & { icon: React.ComponentType<{ className?: string }> })[] = [
  { href: "/visitors/new", label: "Register visitor", perm: "visitors.create", icon: UserPlus },
  { href: "/members/new", label: "Add member", perm: "members.manage", icon: Users },
  { href: "/attendance", label: "Take attendance", perm: "attendance.record", icon: ClipboardCheck },
  { href: "/giving/new", label: "Record contribution", perm: "giving.manage", icon: HandCoins },
  { href: "/services?new=1", label: "Schedule service", perm: "services.manage", icon: Church },
];

export function AppShell({
  children,
  unread,
  permissions,
  ...props
}: ShellProps & { children: React.ReactNode; unread: number; permissions: string[] }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const search = useCommandSearch();
  const perms = new Set(permissions);
  const quick = QUICK.filter((q) => perms.has(q.perm) || (q.perm === "visitors.create" && perms.has("visitors.manage")));

  const bottom = [
    { href: "/dashboard", label: "Home", icon: Home, show: true },
    { href: "/attendance", label: "Check-in", icon: ClipboardCheck, show: perms.has("attendance.record") },
    { href: "/visitors/new", label: "Visitor", icon: UserPlus, show: perms.has("visitors.create") || perms.has("visitors.manage"), primary: true },
    { href: "/followups", label: "Follow-ups", icon: PhoneCall, show: true },
  ].filter((b) => b.show);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <Sidebar {...props} />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="gap-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center border-b px-5">
            <Logo />
          </div>
          <div className="border-b p-3">
            <ChurchSwitcher church={props.church} churches={props.churches} />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav allowed={props.allowed} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur sm:h-16 sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <Link href="/dashboard" className="lg:hidden" aria-label="ChurchX home">
            <Logo withText={false} />
          </Link>
          <SearchTrigger onOpen={() => search.setOpen(true)} className="hidden md:flex" />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => search.setOpen(true)} aria-label="Search">
              <Search />
            </Button>
            {quick.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="hidden sm:inline-flex">
                    <Plus /> New
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
                  {quick.map((q) => (
                    <DropdownMenuItem key={q.href} asChild>
                      <Link href={q.href}>
                        <q.icon /> {q.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <NotificationsBell initialUnread={unread} />
            <UserMenu user={props.user} />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1400px] px-3 pt-4 pb-28 sm:px-5 sm:pt-6 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation: frequent actions within thumb reach */}
      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="flex items-stretch justify-around">
          {bottom.map((b) => {
            const active = isActive(pathname, b.href);
            return (
              <li key={b.href} className="flex-1">
                <Link
                  href={b.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}
                >
                  {b.primary ? (
                    <span className="-mt-5 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-card">
                      <b.icon className="size-5" />
                    </span>
                  ) : (
                    <b.icon className="size-5" />
                  )}
                  {b.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
            >
              <Menu className="size-5" />
              More
            </button>
          </li>
        </ul>
      </nav>

      <CommandSearch open={search.open} onOpenChange={search.setOpen} />
    </div>
  );
}
