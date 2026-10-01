-- ChurchX: core tenancy, identity, roles & permissions
-- Every tenant-owned table carries church_id and is protected by RLS.

create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Generic trigger helpers
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Forces the "who did this" column (name passed as TG_ARGV[0]) to the
-- authenticated user so clients cannot spoof authorship. Service-role / seed
-- inserts (auth.uid() is null) keep the supplied value.
create or replace function private.set_actor_column()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new := jsonb_populate_record(new, jsonb_build_object(tg_argv[0], auth.uid()));
  end if;
  return new;
end $$;

-- Tenant rows can never be moved between churches.
create or replace function private.prevent_church_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.church_id is distinct from old.church_id then
    raise exception 'church_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Churches (tenants)
-- ---------------------------------------------------------------------------
create table public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  logo_path text,
  country text,
  state text,
  city text,
  address text,
  phone text,
  email text,
  website text,
  timezone text not null default 'Africa/Lagos',
  currency char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'active' check (status in ('active', 'suspended')),
  onboarding_completed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger churches_updated_at before update on public.churches
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users). Church members do NOT have accounts.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_path text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Roles & permissions (global catalogue; extensible without code changes)
-- ---------------------------------------------------------------------------
create table public.roles (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  name text not null,
  description text,
  sort_order int not null default 0,
  is_system boolean not null default true
);

create table public.permissions (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null
);

create table public.role_permissions (
  role_key text not null references public.roles (key) on delete cascade,
  permission text not null references public.permissions (key) on delete cascade,
  primary key (role_key, permission)
);

-- ---------------------------------------------------------------------------
-- Church users (staff accounts that operate a church)
-- ---------------------------------------------------------------------------
create table public.church_users (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null references public.roles (key),
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  member_id uuid, -- optional link to the person's member record (FK added later)
  invited_email text,
  invited_by uuid references auth.users (id) on delete set null,
  invited_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, user_id)
);
create index church_users_user_idx on public.church_users (user_id) where status = 'active';
create trigger church_users_updated_at before update on public.church_users
  for each row execute function private.set_updated_at();
create trigger church_users_church_lock before update on public.church_users
  for each row execute function private.prevent_church_change();

-- ---------------------------------------------------------------------------
-- Church settings (1:1)
-- ---------------------------------------------------------------------------
create table public.church_settings (
  church_id uuid primary key references public.churches (id) on delete cascade,
  default_service_days smallint[] not null default '{0}'
    check (default_service_days <@ array[0,1,2,3,4,5,6]::smallint[]),
  member_number_prefix text not null default 'CX' check (member_number_prefix ~ '^[A-Z0-9]{1,8}$'),
  member_seq integer not null default 0,
  care_rules jsonb not null default '{
    "absent_consecutive": 2,
    "absent_long": 4,
    "visitor_contact_days": 2,
    "attendance_drop_pct": 50,
    "birthday_lookahead_days": 7,
    "no_department_after_days": 14
  }'::jsonb,
  care_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger church_settings_updated_at before update on public.church_settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER to avoid RLS recursion).
-- Live in the non-exposed "private" schema.
-- ---------------------------------------------------------------------------
create or replace function private.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = auth.uid()), false)
$$;

-- Churches in which the current user holds the given permission.
create or replace function private.churches_with(p_perm text)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select cu.church_id
  from public.church_users cu
  join public.role_permissions rp on rp.role_key = cu.role
  where cu.user_id = auth.uid() and cu.status = 'active' and rp.permission = p_perm
  union
  select c.id from public.churches c where private.is_super_admin()
$$;

-- Churches the current user actively belongs to (any role).
create or replace function private.my_churches()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select cu.church_id from public.church_users cu
  where cu.user_id = auth.uid() and cu.status = 'active'
  union
  select c.id from public.churches c where private.is_super_admin()
$$;

create or replace function private.has_permission(p_church uuid, p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_super_admin() or exists (
    select 1 from public.church_users cu
    join public.role_permissions rp on rp.role_key = cu.role
    where cu.church_id = p_church and cu.user_id = auth.uid()
      and cu.status = 'active' and rp.permission = p_perm
  )
$$;

create or replace function private.is_church_member(p_church uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_super_admin() or exists (
    select 1 from public.church_users cu
    where cu.church_id = p_church and cu.user_id = auth.uid() and cu.status = 'active'
  )
$$;

-- True only for the service role or a direct DB session with no JWT at all
-- (pg_cron, migrations, psql). PostgREST always sets request.jwt.claims.
create or replace function private.is_trusted_context()
returns boolean language sql stable set search_path = '' as $$
  select auth.uid() is null and (
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
    or (nullif(current_setting('request.jwt.claims', true), '') is null
        and session_user not in ('authenticator', 'anon', 'authenticated'))
  )
$$;

create or replace function private.assert_permission(p_church uuid, p_perm text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if private.is_trusted_context() then
    return; -- service role / cron, never an end-user request
  end if;
  if not private.has_permission(p_church, p_perm) then
    raise exception 'Permission denied: %', p_perm using errcode = '42501';
  end if;
end $$;

create or replace function private.church_today(p_church uuid)
returns date language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce((select c.timezone from public.churches c where c.id = p_church), 'UTC'))::date
$$;

-- Users who share at least one church with the current user (for names in UI).
create or replace function private.shares_church(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.church_users a
    join public.church_users b on b.church_id = a.church_id
    where a.user_id = auth.uid() and a.status = 'active' and b.user_id = p_user
  ) or private.is_super_admin()
$$;

-- Guard against privilege escalation on church_users.
create or replace function private.guard_church_users()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  remaining int;
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id cannot be changed' using errcode = '42501';
    end if;
    -- Never leave a church without an active admin.
    if old.role = 'church_admin' and old.status = 'active'
       and (new.role <> 'church_admin' or new.status <> 'active') then
      select count(*) into remaining from public.church_users
      where church_id = old.church_id and role = 'church_admin' and status = 'active' and id <> old.id;
      if remaining = 0 then
        raise exception 'A church must keep at least one active Church Admin' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger church_users_guard before update on public.church_users
  for each row execute function private.guard_church_users();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.churches enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.church_users enable row level security;
alter table public.church_settings enable row level security;

create policy churches_select on public.churches for select to authenticated
  using (id in (select private.my_churches()));
create policy churches_update on public.churches for update to authenticated
  using (id in (select private.churches_with('church.manage')))
  with check (id in (select private.churches_with('church.manage')));

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_church(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy roles_select on public.roles for select to authenticated using (true);
create policy permissions_select on public.permissions for select to authenticated using (true);
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);

create policy church_users_select on public.church_users for select to authenticated
  using (user_id = (select auth.uid()) or church_id in (select private.my_churches()));
create policy church_users_insert on public.church_users for insert to authenticated
  with check (church_id in (select private.churches_with('users.manage')));
create policy church_users_update on public.church_users for update to authenticated
  using (church_id in (select private.churches_with('users.manage')))
  with check (church_id in (select private.churches_with('users.manage')));

create policy church_settings_select on public.church_settings for select to authenticated
  using (church_id in (select private.my_churches()));
create policy church_settings_update on public.church_settings for update to authenticated
  using (church_id in (select private.churches_with('church.manage')))
  with check (church_id in (select private.churches_with('church.manage')));

-- ---------------------------------------------------------------------------
-- Seed role / permission catalogue
-- ---------------------------------------------------------------------------
insert into public.roles (key, name, description, sort_order) values
  ('church_admin', 'Church Admin', 'Manages the church, users, members, attendance, departments, events and reports.', 1),
  ('pastor', 'Pastor', 'Views members, attendance, follow-up, member care and reports.', 2),
  ('finance', 'Finance', 'Records contributions and views financial reports.', 3),
  ('department_leader', 'Department Leader', 'Sees only the departments they lead and their members.', 4),
  ('followup_worker', 'Follow-up Worker', 'Sees people assigned to them and records follow-up activity.', 5),
  ('attendance_worker', 'Attendance Worker', 'Checks people in and registers visitors. No access to confidential data.', 6);

insert into public.permissions (key, description) values
  ('church.manage', 'Edit church profile and settings'),
  ('users.manage', 'Invite users and change roles'),
  ('members.view', 'View member directory including contact details'),
  ('members.manage', 'Create, edit and archive members'),
  ('members.notes', 'Add notes to member profiles'),
  ('members.view_sensitive', 'View confidential notes'),
  ('visitors.view', 'View all visitors'),
  ('visitors.create', 'Register first-time visitors'),
  ('visitors.manage', 'Edit visitors and convert them to members'),
  ('followups.view_all', 'View every follow-up'),
  ('followups.manage', 'Assign follow-ups to workers'),
  ('care.view', 'View member care alerts'),
  ('care.manage', 'Resolve and assign member care alerts'),
  ('services.view', 'View services'),
  ('services.manage', 'Create and edit services and service types'),
  ('attendance.view', 'View attendance records'),
  ('attendance.record', 'Check people in'),
  ('attendance.correct', 'Correct attendance records'),
  ('departments.view', 'View all departments'),
  ('departments.manage', 'Create departments and manage their members'),
  ('events.view', 'View events'),
  ('events.manage', 'Create and edit events'),
  ('events.checkin', 'Register and check in event attendees'),
  ('giving.view', 'View contributions'),
  ('giving.manage', 'Record and edit contributions'),
  ('reports.view', 'View non-financial reports'),
  ('reports.finance', 'View financial reports'),
  ('audit.view', 'View the audit log'),
  ('data.export', 'Export data to CSV'),
  ('data.import', 'Import data from CSV');

-- Church admin: everything.
insert into public.role_permissions (role_key, permission)
  select 'church_admin', key from public.permissions;

insert into public.role_permissions (role_key, permission) values
  ('pastor', 'members.view'), ('pastor', 'members.notes'), ('pastor', 'members.view_sensitive'),
  ('pastor', 'visitors.view'), ('pastor', 'followups.view_all'), ('pastor', 'followups.manage'),
  ('pastor', 'care.view'), ('pastor', 'care.manage'), ('pastor', 'services.view'),
  ('pastor', 'attendance.view'), ('pastor', 'departments.view'), ('pastor', 'events.view'),
  ('pastor', 'reports.view'),
  ('finance', 'giving.view'), ('finance', 'giving.manage'), ('finance', 'reports.finance'),
  ('finance', 'data.export'),
  ('department_leader', 'services.view'), ('department_leader', 'events.view'),
  ('followup_worker', 'visitors.create'), ('followup_worker', 'services.view'),
  ('attendance_worker', 'services.view'), ('attendance_worker', 'attendance.record'),
  ('attendance_worker', 'visitors.create'), ('attendance_worker', 'events.view'),
  ('attendance_worker', 'events.checkin');
