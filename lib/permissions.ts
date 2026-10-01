/** Permission keys — must match public.permissions in the database. */
export const PERMISSIONS = [
  "church.manage",
  "users.manage",
  "members.view",
  "members.manage",
  "members.notes",
  "members.view_sensitive",
  "visitors.view",
  "visitors.create",
  "visitors.manage",
  "followups.view_all",
  "followups.manage",
  "care.view",
  "care.manage",
  "services.view",
  "services.manage",
  "attendance.view",
  "attendance.record",
  "attendance.correct",
  "departments.view",
  "departments.manage",
  "events.view",
  "events.manage",
  "events.checkin",
  "giving.view",
  "giving.manage",
  "reports.view",
  "reports.finance",
  "audit.view",
  "data.export",
  "data.import",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  { key: "church_admin", name: "Church Admin" },
  { key: "pastor", name: "Pastor" },
  { key: "finance", name: "Finance" },
  { key: "department_leader", name: "Department Leader" },
  { key: "followup_worker", name: "Follow-up Worker" },
  { key: "attendance_worker", name: "Attendance Worker" },
] as const;

export type RoleKey = (typeof ROLES)[number]["key"];

export function roleName(key: string) {
  return ROLES.find((r) => r.key === key)?.name ?? key;
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/** True if the permission set contains ANY of the requested permissions. */
export function hasAny(perms: ReadonlySet<string>, required: readonly Permission[] | undefined) {
  if (!required || required.length === 0) return true;
  return required.some((p) => perms.has(p));
}
