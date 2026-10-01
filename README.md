# ChurchX

A church management system for churches in Nigeria and beyond, built as a multi-tenant SaaS.
It follows the member journey **Visitor → Follow-up → Member → Department → Attendance → Member Care → Reporting**,
and is designed so a church worker with limited technical knowledge can run Sunday check-in from a phone.

## Features

| Area | What you can do |
|---|---|
| **Dashboard** | Live KPIs (members, new members, visitors, attendance, giving, people needing attention), attendance/growth/conversion/giving charts with table views, upcoming services and events, quick actions |
| **Members** | Add/edit/archive, photo upload, search, filters (status, department, gender), sort, pagination, bulk status/department/follow-up actions, duplicate detection, CSV import & export, detailed profile (attendance %, last attended, membership duration, birthday, departments, follow-ups, events, ordinary vs confidential notes, giving for finance roles) |
| **Visitors** | Fast mobile registration, statuses, prayer requests, auto check-in to the service, one-click conversion to member that keeps follow-up/event history |
| **Follow-ups** | Assign to workers, My / Today / Overdue / Upcoming / Completed views, tap-to-call, WhatsApp and SMS links, record method/outcome/notes, schedule the next follow-up, reassign/cancel |
| **Member Care** | Automatic alerts: absent 2+ / 4+ services, attendance drop, visitor not contacted, overdue follow-up, birthday today/this week, new member without department. Configurable rules, assign worker, mark resolved |
| **Services & Attendance** | Service types with default days, auto-scheduling, search-and-tap check-in, member-list bulk check-in, visitor check-in, duplicate prevention, corrections with audit trail |
| **Departments** | Leaders/assistants, multiple departments per member, membership history (joined/left), leader-only visibility |
| **Events** | Registration for members, visitors and walk-in guests, capacity and open/closed registration enforced in the database, check-in |
| **Giving** | Configurable categories, anonymous gifts, payment methods, references, edit and void (never delete), finance reports by category/method/month, CSV export |
| **Reports** | Weekly/monthly attendance, per-service attendance, member growth, visitor conversion, follow-up performance, department membership, retention; filters by date, service type, department, member status; CSV export |
| **Platform** | Global search (Ctrl+K), in-app notifications, audit log, users & roles with invitations, church settings & branding, dark mode, responsive mobile UI |

Deferred items are listed under [Roadmap](#roadmap--deferred). Nothing is faked: WhatsApp actions open a `wa.me` link, and the app never claims a message was delivered.

## Technology

- **Next.js 16** (App Router, Server Components, Server Actions, `proxy.ts`), **React 19**, **TypeScript**
- **Tailwind CSS 4**, **shadcn/ui-style** components on Radix primitives, **Lucide** icons, **Recharts**
- **Supabase**: PostgreSQL with Row Level Security, Auth, Storage
- **Zod** validation, **Vitest** (unit and database tests), **Playwright** (end-to-end tests)
- Deploys to **Vercel**

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the architecture, entity model, permission matrix and design decisions.

## Requirements

- Node.js 20.9+ (22 recommended)
- A Supabase project (cloud), or the Supabase CLI with Docker for local development
- Optional: PostgreSQL 15+ for the database test suite

## Getting started

```bash
git clone <repo> churchx && cd churchx
npm install
cp .env.example .env.local   # then fill in the values
```

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **Apply the migrations** in `supabase/migrations/` in filename order. Use either:
   - Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`, or
   - the dashboard SQL editor: run each file in order.
3. **Auth settings** (Dashboard → Authentication):
   - **URL configuration**: Site URL = your app URL (for example `https://churchx.vercel.app`); add `http://localhost:3000/**` and your production URL `/**` to the redirect URLs.
   - **Email templates**: paste the templates from `supabase/templates/` (confirm signup, reset password, invite user, magic link). They link to `/auth/confirm?token_hash=…`, which is what the server-side auth flow expects.
   - For production, configure custom SMTP so emails are not rate-limited.
4. **Storage**: the migrations create the `church-assets` (public logos) and `member-photos` (private) buckets and their policies.
5. Optional: schedule member-care recalculation with `pg_cron`. It already runs on dashboard and Member Care page loads, throttled to every 10 minutes:
   ```sql
   select cron.schedule('churchx-care', '*/30 * * * *',
     $$select public.refresh_member_care(id, true) from public.churches where status = 'active'$$);
   ```

### 2. Environment variables

| Variable | Required | Where it's used |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Browser + server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Browser + server (publishable key or legacy anon key; `NEXT_PUBLIC_SUPABASE_ANON_KEY` also accepted) |
| `SUPABASE_SECRET_KEY` | for invitations and seeding | **Server only**: staff invitations (`auth.admin`) and `npm run db:seed`. Legacy `SUPABASE_SERVICE_ROLE_KEY` is also accepted |
| `NEXT_PUBLIC_SITE_URL` | recommended | Base URL in auth emails. Falls back to the Vercel URL |
| `CHURCHX_ALLOW_SEED` | dev only | Must be `1` for the seed script to run |
| `TEST_DATABASE_URL` | tests only | PostgreSQL server for the database test suite |

Never commit `.env.local`. `.gitignore` excludes every `.env*` file except `.env.example`.

### 3. Run

```bash
npm run dev          # http://localhost:3000 → Register → onboarding wizard → dashboard
```

### Demo data (development only)

```bash
CHURCHX_ALLOW_SEED=1 npm run db:seed
```

This creates **Grace Assembly (Demo)** with members, visitors, departments, 12 weeks of services and attendance, follow-ups, contributions and events, plus one account per role. All accounts use the password `ChurchX-demo-2026`, which you can override with `SEED_PASSWORD`:

| Role | Email |
|---|---|
| Church Admin | `admin@demo.churchx.app` |
| Pastor | `pastor@demo.churchx.app` |
| Finance | `finance@demo.churchx.app` |
| Follow-up worker | `followup@demo.churchx.app` |
| Attendance worker | `attendance@demo.churchx.app` |
| Department leader (Choir) | `leader@demo.churchx.app` |

The seed refuses to run without `CHURCHX_ALLOW_SEED=1` and when `NODE_ENV`/`VERCEL_ENV` is `production`. It is never run automatically.

### Local backend without Docker

If you can't run Docker for `supabase start`, `scripts/local-stack/start.sh` runs a Supabase-compatible stack (PostgreSQL, the GoTrue auth binary, the PostgREST binary and a small gateway), applies the migrations, and prints the matching `.env.local` values. Prerequisites are listed at the top of the script.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | Generate route types and run `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test:unit` | Unit tests (validation, phone/CSV/import helpers, security helpers) |
| `npm run test:db` | **Database tests**: tenant isolation, role permissions, workflows, against real migrations (needs `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright end-to-end tests against a running, **seeded** dev app |
| `npm run db:types` | Regenerate `types/database.ts` from a migrated database (`DATABASE_URL=…`) |
| `npm run db:seed` | Demo data (see above) |

### Testing

- **Database tests** (`tests/db`) load a Supabase stand-in for the `auth`/`storage` schemas, apply every migration to a throwaway database, then act as real users the way PostgREST does (`SET ROLE authenticated` plus JWT claims). They cover:
  - **Tenant isolation** (mandatory): a Church A user cannot read, insert, update, move, link to, search, export or call reports/RPCs for Church B data, including storage objects.
  - **Role permissions**: attendance workers, finance, pastors, department leaders and follow-up workers each see only what they should; privilege escalation is blocked (super-admin flag, role changes, last-admin demotion, audit tampering, hard deletes).
  - **Workflows**: onboarding, membership numbers, validation, visitor conversion with preserved history, attendance corrections, duplicate prevention, follow-up assignment and notifications, event capacity, member-care rules (absence, birthdays, no department, overdue follow-ups, auto-resolve), reports.

  ```bash
  TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db
  ```
- **End-to-end tests** (`tests/e2e`) log in as every seeded role, visit every page, assert that restricted pages are blocked, and run the core workflows (add member and duplicate detection, check-in and duplicate prevention, mobile visitor registration and conversion, record and void giving, record a follow-up, permission-aware search, and cross-church isolation through the UI).

## Deploying to Vercel

1. Push the repository to GitHub and import it in Vercel. The framework is detected as Next.js and no build settings are needed.
2. Add the environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (mark it sensitive, server only) and `NEXT_PUBLIC_SITE_URL`.
3. Deploy, then set the Supabase Auth **Site URL** and redirect URLs to the Vercel domain.
4. Do **not** set `CHURCHX_ALLOW_SEED` in production.

## Security notes

- **Row Level Security on every table.** Policies check permissions per church through `SECURITY DEFINER` helpers in a non-exposed `private` schema. The UI hides things only for convenience; the database is the authority.
- **Composite tenant foreign keys** (`(church_id, x_id) → parent(church_id, id)`) make cross-church references impossible, even though FK checks bypass RLS. `church_id` cannot be changed after insert.
- **Server Actions** resolve the church from the session (the cookie is only a selector, re-validated on every request), check permissions, validate with Zod, and write with the **user's** session so RLS still applies. Client-supplied church IDs are never trusted.
- **Service-role key** is used only server-side for `auth.admin.inviteUserByEmail`, after a permission check. It is never exposed to the browser.
- **Least privilege**: attendance and finance roles get contact-free lookups instead of the member directory; confidential notes need `members.view_sensitive`; giving needs `giving.view`.
- **No hard deletes** through the app: there are no DELETE grants. Members are archived, contributions voided with a reason, department memberships ended.
- **Audit log** is written by database triggers (no code path can skip it). It is append-only and stores changed field *names*, not personal values.
- CSV exports neutralise spreadsheet formula injection. Errors shown to users never include raw database messages, and server logs record error codes, not row data.
- Auth redirects are restricted to same-origin paths, and password reset responses don't reveal whether an email exists.

## Project structure

```
app/                 routes: (auth) login/register/reset, onboarding, (app) shell + feature pages, api/export
components/ui        shadcn-style primitives      components/app   shared app components
components/shell     sidebar, header, search, notifications   components/charts  charts with table views
features/<domain>    server actions, queries and client components per domain
lib/                 supabase clients, auth context/guards, validation, formatting, CSV/import helpers
supabase/migrations  schema, RLS, functions, grants, storage   supabase/templates  auth emails
scripts/             seed, type generator, Docker-free local stack
tests/unit | db | e2e
docs/ARCHITECTURE.md
```

## Roadmap / deferred

These are intentionally **not** built yet. The schema leaves room for each:

- External notifications (email/SMS/WhatsApp Business/push). `notifications.channel` and `delivery_status` already exist.
- Online giving via Paystack, Flutterwave or Stripe. `contributions.source` and `external_id` (unique) are ready for webhooks.
- QR, NFC or kiosk check-in. `attendance.method` already supports these values.
- PDF export (use the browser's Print → Save as PDF for now), custom per-church roles (permissions are already data-driven), magic-link sign-in (the `/auth/callback` route is ready), multiple branches, small groups/cells, child check-in, volunteer scheduling, PWA, public API and webhooks.
