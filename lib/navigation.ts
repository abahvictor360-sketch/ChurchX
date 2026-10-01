import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Church,
  HandCoins,
  HeartHandshake,
  LayoutDashboard,
  PhoneCall,
  Settings,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: LucideIcon; any?: Permission[] };
export type NavSection = { label: string; items: NavItem[] };

export const NAV: NavSection[] = [
  {
    label: "Main",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "People",
    items: [
      { href: "/members", label: "Members", icon: Users, any: ["members.view", "members.manage"] },
      { href: "/visitors", label: "Visitors", icon: UserPlus, any: ["visitors.view", "visitors.create", "visitors.manage"] },
      { href: "/followups", label: "Follow-ups", icon: PhoneCall },
      { href: "/care", label: "Member Care", icon: HeartHandshake, any: ["care.view"] },
    ],
  },
  {
    label: "Church",
    items: [
      { href: "/services", label: "Services", icon: Church, any: ["services.view", "services.manage"] },
      { href: "/attendance", label: "Attendance", icon: ClipboardCheck, any: ["attendance.record", "attendance.view"] },
      { href: "/departments", label: "Departments", icon: UsersRound },
      { href: "/events", label: "Events", icon: CalendarDays, any: ["events.view", "events.manage", "events.checkin"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/giving", label: "Contributions", icon: HandCoins, any: ["giving.view", "giving.manage"] },
      { href: "/reports/finance", label: "Finance Reports", icon: Wallet, any: ["reports.finance", "giving.view"] },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, any: ["reports.view"] },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];
