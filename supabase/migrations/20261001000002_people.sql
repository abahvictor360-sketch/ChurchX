-- ChurchX: people — members, visitors, departments, notes, follow-ups
-- Composite (church_id, id) foreign keys guarantee that child rows can only
-- reference parents from the SAME church (FK checks bypass RLS, so this is
-- what stops cross-tenant linking).

-- ---------------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------------
create table public.members (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  photo_path text,
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  middle_name text check (middle_name is null or char_length(middle_name) <= 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 80),
  gender text check (gender in ('male', 'female')),
  date_of_birth date check (date_of_birth is null or date_of_birth >= '1900-01-01'),
  phone text check (phone is null or phone ~ '^\+?[0-9]{7,15}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address text,
  city text,
  state text,
  country text,
  marital_status text check (marital_status in ('single', 'married', 'widowed', 'divorced', 'separated')),
  membership_status text not null default 'new_member'
    check (membership_status in ('visitor', 'new_member', 'active', 'inactive', 'transferred', 'archived')),
  membership_number text,
  join_date date not null default current_date,
  occupation text,
  emergency_contact_name text,
  emergency_contact_phone text check (emergency_contact_phone is null or emergency_contact_phone ~ '^\+?[0-9]{7,15}$'),
  notes text check (notes is null or char_length(notes) <= 4000),
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text generated always as (
    first_name || coalesce(' ' || middle_name, '') || ' ' || last_name
  ) stored,
  search_text text generated always as (
    lower(first_name || ' ' || coalesce(middle_name || ' ', '') || last_name || ' ' ||
          coalesce(phone, '') || ' ' || coalesce(email, '') || ' ' || coalesce(membership_number, ''))
  ) stored,
  unique (church_id, id),
  unique (church_id, membership_number)
);
create index members_church_status_idx on public.members (church_id, membership_status);
create index members_church_name_idx on public.members (church_id, last_name, first_name);
create index members_church_join_idx on public.members (church_id, join_date);
create index members_search_trgm_idx on public.members using gin (search_text extensions.gin_trgm_ops);
create index members_church_phone_idx on public.members (church_id, phone) where phone is not null;
create index members_dob_idx on public.members (church_id, extract(month from date_of_birth), extract(day from date_of_birth))
  where date_of_birth is not null;

create trigger members_updated_at before update on public.members
  for each row execute function private.set_updated_at();
create trigger members_church_lock before update on public.members
  for each row execute function private.prevent_church_change();
create trigger members_created_by before insert on public.members
  for each row execute function private.set_actor_column('created_by');

-- Auto-assign a per-church membership number (e.g. CX-00042).
create or replace function private.assign_membership_number()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  n int;
  prefix text;
begin
  if new.membership_number is null or trim(new.membership_number) = '' then
    update public.church_settings
       set member_seq = member_seq + 1
     where church_id = new.church_id
    returning member_seq, member_number_prefix into n, prefix;
    if n is null then
      insert into public.church_settings (church_id, member_seq) values (new.church_id, 1)
      on conflict (church_id) do update set member_seq = public.church_settings.member_seq + 1
      returning member_seq, member_number_prefix into n, prefix;
    end if;
    new.membership_number := prefix || '-' || lpad(n::text, 5, '0');
  end if;
  if new.membership_status = 'archived' and new.archived_at is null then
    new.archived_at := now();
  elsif new.membership_status <> 'archived' then
    new.archived_at := null;
  end if;
  return new;
end $$;
create trigger members_number before insert or update of membership_status, membership_number on public.members
  for each row execute function private.assign_membership_number();

alter table public.church_users
  add constraint church_users_member_fk foreign key (church_id, member_id)
  references public.members (church_id, id) on delete set null (member_id);

-- ---------------------------------------------------------------------------
-- Member notes (ordinary vs confidential)
-- ---------------------------------------------------------------------------
create table public.member_notes (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  member_id uuid not null,
  visibility text not null default 'general' check (visibility in ('general', 'confidential')),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (church_id, member_id) references public.members (church_id, id) on delete cascade
);
create index member_notes_member_idx on public.member_notes (church_id, member_id, created_at desc);
create trigger member_notes_updated_at before update on public.member_notes
  for each row execute function private.set_updated_at();
create trigger member_notes_church_lock before update on public.member_notes
  for each row execute function private.prevent_church_change();
create trigger member_notes_created_by before insert on public.member_notes
  for each row execute function private.set_actor_column('created_by');

-- ---------------------------------------------------------------------------
-- Visitors (first-timers). Converting keeps the row and links the member.
-- ---------------------------------------------------------------------------
create table public.visitors (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text check (last_name is null or char_length(last_name) <= 80),
  phone text check (phone is null or phone ~ '^\+?[0-9]{7,15}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  gender text check (gender in ('male', 'female')),
  address text,
  heard_about text check (heard_about is null or char_length(heard_about) <= 200),
  service_id uuid, -- FK added with services
  prayer_request text check (prayer_request is null or char_length(prayer_request) <= 2000),
  invited_by text check (invited_by is null or char_length(invited_by) <= 160),
  visit_date date not null default current_date,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'followup_ongoing', 'interested', 'converted', 'not_interested', 'unreachable')),
  converted_member_id uuid,
  converted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text generated always as (first_name || coalesce(' ' || last_name, '')) stored,
  search_text text generated always as (
    lower(first_name || ' ' || coalesce(last_name, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(email, ''))
  ) stored,
  unique (church_id, id),
  foreign key (church_id, converted_member_id) references public.members (church_id, id) on delete set null (converted_member_id),
  check ((status = 'converted') = (converted_member_id is not null))
);
create index visitors_church_status_idx on public.visitors (church_id, status, visit_date desc);
create index visitors_church_date_idx on public.visitors (church_id, visit_date desc);
create index visitors_search_trgm_idx on public.visitors using gin (search_text extensions.gin_trgm_ops);
create trigger visitors_updated_at before update on public.visitors
  for each row execute function private.set_updated_at();
create trigger visitors_church_lock before update on public.visitors
  for each row execute function private.prevent_church_change();
create trigger visitors_created_by before insert on public.visitors
  for each row execute function private.set_actor_column('created_by');

-- ---------------------------------------------------------------------------
-- Departments & historical membership
-- ---------------------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text check (description is null or char_length(description) <= 1000),
  leader_member_id uuid,
  assistant_member_id uuid,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  constraint departments_leader_fk foreign key (church_id, leader_member_id)
    references public.members (church_id, id) on delete set null (leader_member_id),
  constraint departments_assistant_fk foreign key (church_id, assistant_member_id)
    references public.members (church_id, id) on delete set null (assistant_member_id)
);
create unique index departments_church_name_uq on public.departments (church_id, lower(name));
create trigger departments_updated_at before update on public.departments
  for each row execute function private.set_updated_at();
create trigger departments_church_lock before update on public.departments
  for each row execute function private.prevent_church_change();

create table public.department_members (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  department_id uuid not null,
  member_id uuid not null,
  joined_on date not null default current_date,
  left_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (church_id, department_id) references public.departments (church_id, id) on delete cascade,
  foreign key (church_id, member_id) references public.members (church_id, id) on delete cascade,
  check (left_on is null or left_on >= joined_on)
);
create unique index department_members_active_uq on public.department_members (department_id, member_id)
  where left_on is null;
create index department_members_member_idx on public.department_members (church_id, member_id) where left_on is null;
create trigger department_members_updated_at before update on public.department_members
  for each row execute function private.set_updated_at();
create trigger department_members_church_lock before update on public.department_members
  for each row execute function private.prevent_church_change();

-- ---------------------------------------------------------------------------
-- Follow-ups. One row = one follow-up task; completing it records the
-- contact method/outcome and may schedule the next one (parent_id chain).
-- ---------------------------------------------------------------------------
create table public.followups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  member_id uuid,
  visitor_id uuid,
  assigned_to uuid not null,
  assigned_by uuid references auth.users (id) on delete set null,
  due_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  contact_method text check (contact_method in ('phone', 'whatsapp', 'sms', 'email', 'visit', 'other')),
  outcome text check (outcome in ('reached', 'no_answer', 'wrong_number', 'call_back', 'interested',
                                  'not_interested', 'prayer_needed', 'visited', 'other')),
  notes text check (notes is null or char_length(notes) <= 4000),
  next_followup_date date,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  parent_id uuid references public.followups (id) on delete set null,
  care_alert_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  foreign key (church_id, member_id) references public.members (church_id, id) on delete cascade,
  foreign key (church_id, visitor_id) references public.visitors (church_id, id) on delete cascade,
  -- the assignee must be a user of THIS church
  foreign key (church_id, assigned_to) references public.church_users (church_id, user_id),
  check (member_id is not null or visitor_id is not null),
  check (status <> 'completed' or (contact_method is not null and completed_at is not null))
);
create index followups_assignee_idx on public.followups (assigned_to, status, due_date);
create index followups_church_status_idx on public.followups (church_id, status, due_date);
create index followups_member_idx on public.followups (church_id, member_id) where member_id is not null;
create index followups_visitor_idx on public.followups (church_id, visitor_id) where visitor_id is not null;
create trigger followups_updated_at before update on public.followups
  for each row execute function private.set_updated_at();
create trigger followups_church_lock before update on public.followups
  for each row execute function private.prevent_church_change();
create trigger followups_created_by before insert on public.followups
  for each row execute function private.set_actor_column('created_by');

-- ---------------------------------------------------------------------------
-- Relationship helpers for scoped roles
-- ---------------------------------------------------------------------------
create or replace function private.my_member_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select cu.member_id from public.church_users cu
  where cu.user_id = auth.uid() and cu.status = 'active' and cu.member_id is not null
$$;

create or replace function private.my_led_departments()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select d.id from public.departments d
  where d.status = 'active'
    and (d.leader_member_id in (select private.my_member_ids())
         or d.assistant_member_id in (select private.my_member_ids()))
$$;

create or replace function private.my_led_department_member_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select dm.member_id from public.department_members dm
  where dm.left_on is null and dm.department_id in (select private.my_led_departments())
$$;

create or replace function private.my_followup_member_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select f.member_id from public.followups f
  where f.assigned_to = auth.uid() and f.member_id is not null and f.status <> 'cancelled'
$$;

create or replace function private.my_followup_visitor_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select f.visitor_id from public.followups f
  where f.assigned_to = auth.uid() and f.visitor_id is not null and f.status <> 'cancelled'
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.members enable row level security;
alter table public.member_notes enable row level security;
alter table public.visitors enable row level security;
alter table public.departments enable row level security;
alter table public.department_members enable row level security;
alter table public.followups enable row level security;

-- Members: full directory for members.view; scoped access for department
-- leaders (their department members) and follow-up workers (assigned people).
create policy members_select on public.members for select to authenticated using (
  church_id in (select private.churches_with('members.view'))
  or id in (select private.my_led_department_member_ids())
  or id in (select private.my_followup_member_ids())
);
create policy members_insert on public.members for insert to authenticated
  with check (church_id in (select private.churches_with('members.manage')));
create policy members_update on public.members for update to authenticated
  using (church_id in (select private.churches_with('members.manage')))
  with check (church_id in (select private.churches_with('members.manage')));
-- No DELETE policy: members are archived, never deleted through the app.

create policy member_notes_select on public.member_notes for select to authenticated using (
  (visibility = 'general' and (church_id in (select private.churches_with('members.view'))
                               or church_id in (select private.churches_with('members.notes'))))
  or (visibility = 'confidential' and church_id in (select private.churches_with('members.view_sensitive')))
);
create policy member_notes_insert on public.member_notes for insert to authenticated with check (
  (church_id in (select private.churches_with('members.notes'))
   or church_id in (select private.churches_with('members.manage')))
  and (visibility = 'general' or church_id in (select private.churches_with('members.view_sensitive')))
);

create policy visitors_select on public.visitors for select to authenticated using (
  church_id in (select private.churches_with('visitors.view'))
  or id in (select private.my_followup_visitor_ids())
  or (created_by = (select auth.uid()) and church_id in (select private.my_churches()))
);
create policy visitors_insert on public.visitors for insert to authenticated with check (
  status <> 'converted' and (
  church_id in (select private.churches_with('visitors.create'))
  or church_id in (select private.churches_with('visitors.manage')))
);
create policy visitors_update on public.visitors for update to authenticated
  using (church_id in (select private.churches_with('visitors.manage'))
         or id in (select private.my_followup_visitor_ids()))
  with check (church_id in (select private.churches_with('visitors.manage'))
              or (id in (select private.my_followup_visitor_ids()) and status <> 'converted'));

create policy departments_select on public.departments for select to authenticated using (
  church_id in (select private.churches_with('departments.view'))
  or church_id in (select private.churches_with('departments.manage'))
  or id in (select private.my_led_departments())
);
create policy departments_insert on public.departments for insert to authenticated
  with check (church_id in (select private.churches_with('departments.manage')));
create policy departments_update on public.departments for update to authenticated
  using (church_id in (select private.churches_with('departments.manage')))
  with check (church_id in (select private.churches_with('departments.manage')));

create policy department_members_select on public.department_members for select to authenticated using (
  church_id in (select private.churches_with('departments.view'))
  or church_id in (select private.churches_with('departments.manage'))
  or department_id in (select private.my_led_departments())
);
create policy department_members_insert on public.department_members for insert to authenticated
  with check (church_id in (select private.churches_with('departments.manage')));
create policy department_members_update on public.department_members for update to authenticated
  using (church_id in (select private.churches_with('departments.manage')))
  with check (church_id in (select private.churches_with('departments.manage')));

create policy followups_select on public.followups for select to authenticated using (
  church_id in (select private.churches_with('followups.view_all'))
  or (assigned_to = (select auth.uid()) and church_id in (select private.my_churches()))
);
create policy followups_insert on public.followups for insert to authenticated with check (
  church_id in (select private.churches_with('followups.manage'))
  or (assigned_to = (select auth.uid())
      and church_id in (select private.my_churches())
      and (member_id in (select private.my_followup_member_ids())
           or visitor_id in (select private.my_followup_visitor_ids())))
);
create policy followups_update on public.followups for update to authenticated
  using (church_id in (select private.churches_with('followups.manage'))
         or assigned_to = (select auth.uid()))
  with check (church_id in (select private.churches_with('followups.manage'))
              or (assigned_to = (select auth.uid()) and church_id in (select private.my_churches())));
