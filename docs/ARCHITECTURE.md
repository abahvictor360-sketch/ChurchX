# ChurchX — Architecture

## 1. Repository status at start

The repository was empty (no commits). Everything here was created from scratch:
Next.js 16 (App Router, Turbopack), React 19, TypeScript 5, Tailwind CSS 4,
shadcn/ui-style components on Radix primitives, Supabase (Postgres, Auth, Storage).

> The shadcn CLI could not reach `ui.shadcn.com` from the build environment, so
> the components in `components/ui` were written by hand following the shadcn/ui
> source conventions (Radix + `class-variance-authority` + `tailwind-merge`).
> They are ordinary source files — `npx shadcn add` works normally later.

## 2. High-level design

```
Browser ──► Next.js (Vercel)
             ├─ proxy.ts              refreshes Supabase session cookie, redirects anonymous users
             ├─ Server Components     read data with the *user's* Supabase session (RLS applies)
             ├─ Server Actions        validate with Zod → re-check permission → write via user session
             └─ lib/supabase/admin    service-role client, server-only, used ONLY for auth.admin
                                      (user invitations) after a permission check
Supabase
  ├─ Auth        staff accounts only (church members do not need accounts)
  ├─ Postgres    all business rules that matter for security live here:
  │               RLS on every table, composite tenant FKs, triggers, SECURITY DEFINER RPCs
  └─ Storage     church-assets (public logos), member-photos (private, signed URLs)
```

Defence in depth — every permission is enforced at three layers:

1. **Database (authoritative)** — RLS policies, column privileges, triggers, RPC permission checks.
2. **Server** — every Server Action/route resolves the church from the session (`requireChurch()`),
   checks `can(permission)`, validates input with Zod, then writes **with the user's session** so RLS
   still applies. The church id is never read from form data.
3. **UI** — navigation and buttons are hidden when the user lacks a permission (convenience only).

## 3. Multi-tenancy

* Each church is a tenant (`churches`). Every tenant-owned table has `church_id uuid not null`.
* RLS policies use `church_id in (select private.churches_with('<permission>'))`. The helper is
  `SECURITY DEFINER`, returns the churches where the caller holds the permission, and is evaluated
  once per statement (hashed sub-plan) so it scales.
* **Composite foreign keys** `(church_id, x_id) → parent(church_id, id)` on every child table.
  FK checks bypass RLS, so without these a Church A user could link a Church A row to a Church B
  member id. With them, cross-tenant references are impossible.
* `church_id` is immutable (trigger) — rows cannot be moved between tenants.
* A user may belong to several churches (`church_users`). The active church is a cookie that is
  only a *selector*; access is re-validated on every request and by RLS.
* Super admins (`profiles.is_super_admin`, settable only with the service role/SQL) see all churches.

## 4. Entities

| Table | Purpose |
|---|---|
| `churches` | Tenant + profile (name, logo, location, timezone, currency) |
| `church_settings` | 1:1 settings: default service days, member number prefix, member-care rules |
| `profiles` | 1:1 with `auth.users`: name, phone, super-admin flag |
| `roles`, `permissions`, `role_permissions` | Global, data-driven role → permission catalogue |
| `church_users` | Staff membership: user ↔ church, role, status (invited/active/disabled), optional link to member record |
| `members` | People in the church (no login). Archived, never deleted. Auto membership number |
| `member_notes` | Notes with `general` vs `confidential` visibility |
| `visitors` | First-timers. Conversion links `converted_member_id`, history kept |
| `departments`, `department_members` | Many-to-many with `joined_on/left_on` history |
| `followups` | Follow-up tasks; completion records method/outcome; `parent_id` chains next follow-ups |
| `service_types`, `services` | Configurable types; service instances with status |
| `attendance` | One row per person per service (unique), method ready for QR/kiosk/NFC |
| `events`, `event_registrations` | Events separate from services; members, visitors or guests; capacity enforced |
| `giving_categories`, `contributions` | Configurable categories; voiding instead of deleting; `source/external_id` for payment gateways |
| `member_care_alerts` | Computed alerts with dedupe keys, open/resolved/auto_resolved |
| `notifications` | In-app notifications; `channel`/`delivery_status` reserved for email/SMS/WhatsApp/push |
| `audit_logs` | Append-only, written only by triggers; stores changed field *names*, not personal values |

```
churches 1─1 church_settings
churches 1─* church_users *─1 auth.users 1─1 profiles
churches 1─* members 1─* member_notes
                    1─* department_members *─1 departments
                    1─* attendance *─1 services *─1 service_types
                    1─* followups ─* visitors
                    1─* contributions *─1 giving_categories
                    1─* event_registrations *─1 events
visitors ─(converted_member_id)→ members
member_care_alerts → members | visitors | followups
```

## 5. Permission model

Permissions are strings (`members.view`, `giving.manage`, …) mapped to roles in `role_permissions`.
Adding a role or permission is a data change; policies reference permissions, not roles.

| Permission | Admin | Pastor | Finance | Dept leader | Follow-up | Attendance |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| church.manage / users.manage / audit.view | ✓ | | | | | |
| members.view (directory incl. contact) | ✓ | ✓ | | own depts¹ | assigned¹ | |
| members.manage | ✓ | | | | | |
| members.notes / members.view_sensitive | ✓ | ✓ | | | | |
| visitors.view / visitors.manage | ✓ | view | | | assigned¹ | |
| visitors.create | ✓ | | | | ✓ | ✓ |
| followups.view_all / followups.manage | ✓ | ✓ | | | own¹ | |
| care.view / care.manage | ✓ | ✓ | | | | |
| services.view | ✓ | ✓ | | ✓ | ✓ | ✓ |
| services.manage | ✓ | | | | | |
| attendance.record | ✓ | | | | | ✓ |
| attendance.view / attendance.correct | ✓ | view | | own depts¹ | | own, 12h¹ |
| departments.view / departments.manage | ✓ | view | | own¹ | | |
| events.view / events.manage / events.checkin | ✓ | view | | view | | view, check-in |
| giving.view / giving.manage | ✓ | | ✓ | | | |
| reports.view | ✓ | ✓ | | | | |
| reports.finance | ✓ | | ✓ | | | |
| data.export / data.import | ✓ | | export | | | |

¹ Relationship-based access granted by RLS (e.g. a department leader is the user whose linked member
record is the department's leader/assistant).

Roles that may not see contact details (attendance worker, finance) use contact-free RPCs
(`checkin_search`, `lookup_people`, `service_attendance_list`) that return names and membership
numbers only.

## 6. Routes

```
/login /register /forgot-password /reset-password /auth/confirm /auth/callback
/onboarding                      church setup wizard (skippable optional fields)
/dashboard
/members  /members/new  /members/[id]  /members/[id]/edit  /members/import
/visitors /visitors/new /visitors/[id]
/followups?view=mine|today|overdue|upcoming|completed|all
/care
/services /services/[id]
/attendance  /attendance/[serviceId]   fast mobile check-in
/departments /departments/[id]
/events /events/[id]
/giving  /giving/new
/reports  /reports/finance
/notifications
/settings/(church|users|departments|giving|services|care|data|audit|profile)
/api/export/[entity]             CSV export (permission-checked, RLS-scoped)
```

## 7. Main user journeys

* **Sunday check-in (attendance worker, phone):** Attendance → pick today's service → type 2–3 letters →
  tap "Check in". Already-present people show a badge; duplicates are rejected by a unique constraint.
* **Visitor capture:** Visitors → "New visitor" (one short form, big inputs) → saved with service.
* **After service (follow-up):** Follow-ups → "Today" lists assigned people with tap-to-call and
  WhatsApp links → "Record follow-up" captures method/outcome/next date.
* **Conversion:** Visitor profile → "Convert to member" → pre-filled; history stays linked.
* **Pastoral care:** Member Care shows open alerts by type → open person → record follow-up,
  assign worker, or mark resolved.
* **Finance:** Giving → "Record contribution" → reports by category/method/month → CSV export.

## 8. Member care engine

`refresh_member_care(church)` (SQL, idempotent) computes alerts from configurable rules in
`church_settings.care_rules` (absence streaks, attendance drop, visitors not contacted, overdue
follow-ups, birthdays today/this week, new members without a department), upserts them with dedupe
keys, auto-resolves alerts whose condition cleared, and creates in-app notifications. It runs on
dashboard / member-care page load (throttled to once per 10 minutes per church). Optionally
schedule it with `pg_cron` (see README).

## 9. Key decisions

* **Visitors are a separate table** (visitor-specific fields, clean conversion) linked to the member
  on conversion; follow-ups/attendance/event registrations keep their history.
* **Follow-up = task row.** Completing stores method/outcome; scheduling a next date creates a
  child task. This gives "today/overdue/upcoming/completed" lists with simple indexed queries.
* **No hard deletes** for authenticated users (no DELETE grants). Members are archived,
  contributions voided (with reason), department memberships ended (`left_on`).
* **Audit via triggers** so no code path can skip it; logs store field names, not values.
* **Types** are generated from the migrated schema (`npm run db:types`), so queries are type-checked.
* **Deferred (documented, not faked):** external email/SMS/WhatsApp delivery, payment gateways,
  QR check-in, PDF export, custom per-church roles, magic links (Supabase supports it; UI not wired).

## 10. Technical risks

* `refresh_member_care` runs on page load; very large churches should move it to `pg_cron`.
* Report RPCs aggregate in SQL; date ranges are capped (3 years) to bound cost.
* Phone numbers are normalised to digits (`+234…`) for WhatsApp links; local formats are
  converted using the church's country (Nigeria default).
