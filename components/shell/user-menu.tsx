"use client";

import Link from "next/link";
import { LogOut, Moon, Settings, Sun, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/features/shell/actions";
import { initials } from "@/lib/format";
import { roleName } from "@/lib/permissions";

function toggleTheme() {
  const dark = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("cx-theme", dark ? "dark" : "light");
  } catch {
    // storage unavailable — theme still applies for this page
  }
}

export function UserMenu({ user }: { user: { name: string; email: string | null; role: string } }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label="Account menu">
        <Avatar className="size-9 border-2 border-card shadow-sm">
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-xs">{user.email}</p>
          <p className="mt-1 text-xs text-primary">{roleName(user.role)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <UserRound /> My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleTheme}>
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" /> Toggle dark mode
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
