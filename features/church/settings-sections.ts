import type { Permission } from "@/lib/permissions";

export const SETTINGS_SECTIONS: { href: string; label: string; description: string; any?: Permission[] }[] = [
  { href: "/settings/profile", label: "My profile", description: "Your name, phone and password." },
  { href: "/settings/church", label: "Church profile", description: "Name, logo, contact, timezone, currency and service days.", any: ["church.manage"] },
  { href: "/settings/users", label: "Users & roles", description: "Invite staff and control what each person can access.", any: ["users.manage"] },
  { href: "/settings/services", label: "Service types", description: "Sunday service, midweek, prayer meeting and more.", any: ["services.manage"] },
  { href: "/settings/giving", label: "Giving categories", description: "Tithe, offering, project and other categories.", any: ["church.manage"] },
  { href: "/settings/care", label: "Member care rules", description: "When people should be flagged for attention.", any: ["church.manage"] },
  { href: "/settings/data", label: "Import / export", description: "Bring in members from a spreadsheet or download your data.", any: ["data.import", "data.export"] },
  { href: "/settings/audit", label: "Audit log", description: "Who changed what, and when.", any: ["audit.view"] },
];
