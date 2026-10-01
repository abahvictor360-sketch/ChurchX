-- ChurchX: church operations — service types, services, attendance, events

create table public.service_types (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text,
  default_day smallint check (default_day between 0 and 6),
  default_start_time time,
  default_end_time time,
  include_in_care boolean not null default true, -- counts toward absence detection
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id)
);
create unique index service_types_church_name_uq on public.service_types (church_id, lower(name));
create trigger service_types_updated_at before update on public.service_types
  for each row execute function private.set_updated_at();
create trigger service_types_church_lock before update on public.service_types
  for each row execute function private.prevent_church_change();

create table public.services (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  service_type_id uuid,
  name text not null check (char_length(trim(name)) between 2 and 120),
  service_date date not null,
  start_time time,
  end_time time,
  location text,
  notes text check (notes is null or char_length(notes) <= 2000),
  status text not null default 'scheduled' check (status in ('scheduled', 'ongoing', 'completed', 'cancelled')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  foreign key (church_id, service_type_id) references public.service_types (church_id, id) on delete set null (service_type_id),
  check (end_time is null or start_time is null or end_time > start_time)
);
create index services_church_date_idx on public.services (church_id, service_date desc);
create index services_church_type_idx on public.services (church_id, service_type_id, service_date desc);
create trigger services_updated_at before update on public.services
  for each row execute function private.set_updated_at();
create trigger services_church_lock before update on public.services
  for each row execute function private.prevent_church_change();
create trigger services_created_by before insert on public.services
  for each row execute function private.set_actor_column('created_by');

alter table public.visitors
  add constraint visitors_service_fk foreign key (church_id, service_id)
  references public.services (church_id, id) on delete set null (service_id);

-- ---------------------------------------------------------------------------
-- Attendance: exactly one person per row; unique per service+person.
-- method leaves room for QR / kiosk / NFC check-in later.
-- ---------------------------------------------------------------------------
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  service_id uuid not null,
  member_id uuid,
  visitor_id uuid,
  status text not null default 'present' check (status in ('present', 'absent', 'excused')),
  checked_in_at timestamptz not null default now(),
  method text not null default 'manual' check (method in ('manual', 'bulk', 'qr', 'kiosk', 'nfc')),
  notes text check (notes is null or char_length(notes) <= 500),
  recorded_by uuid references auth.users (id) on delete set null,
  corrected_by uuid references auth.users (id) on delete set null,
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (church_id, service_id) references public.services (church_id, id) on delete cascade,
  foreign key (church_id, member_id) references public.members (church_id, id) on delete cascade,
  foreign key (church_id, visitor_id) references public.visitors (church_id, id) on delete cascade,
  check (num_nonnulls(member_id, visitor_id) = 1),
  constraint attendance_service_member_uq unique (service_id, member_id),
  constraint attendance_service_visitor_uq unique (service_id, visitor_id)
);
create index attendance_church_service_idx on public.attendance (church_id, service_id, status);
create index attendance_member_idx on public.attendance (church_id, member_id, status) where member_id is not null;
create trigger attendance_updated_at before update on public.attendance
  for each row execute function private.set_updated_at();
create trigger attendance_church_lock before update on public.attendance
  for each row execute function private.prevent_church_change();
create trigger attendance_recorded_by before insert on public.attendance
  for each row execute function private.set_actor_column('recorded_by');

create or replace function private.attendance_correction()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.service_id is distinct from old.service_id
     or new.member_id is distinct from old.member_id
     or new.visitor_id is distinct from old.visitor_id then
    raise exception 'Attendance person/service cannot be changed; record a new entry instead' using errcode = '42501';
  end if;
  new.recorded_by := old.recorded_by;
  if auth.uid() is not null then
    new.corrected_by := auth.uid();
    new.corrected_at := now();
  end if;
  return new;
end $$;
create trigger attendance_correction before update on public.attendance
  for each row execute function private.attendance_correction();

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 160),
  description text check (description is null or char_length(description) <= 4000),
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  venue text,
  capacity integer check (capacity is null or capacity > 0),
  registration_status text not null default 'open' check (registration_status in ('open', 'closed')),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id),
  check (end_date >= start_date)
);
create index events_church_date_idx on public.events (church_id, start_date desc);
create trigger events_updated_at before update on public.events
  for each row execute function private.set_updated_at();
create trigger events_church_lock before update on public.events
  for each row execute function private.prevent_church_change();
create trigger events_created_by before insert on public.events
  for each row execute function private.set_actor_column('created_by');

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  event_id uuid not null,
  member_id uuid,
  visitor_id uuid,
  guest_name text check (guest_name is null or char_length(trim(guest_name)) between 2 and 160),
  guest_phone text check (guest_phone is null or guest_phone ~ '^\+?[0-9]{7,15}$'),
  guest_email text check (guest_email is null or guest_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status text not null default 'registered' check (status in ('registered', 'cancelled')),
  attended boolean not null default false,
  checked_in_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (church_id, event_id) references public.events (church_id, id) on delete cascade,
  foreign key (church_id, member_id) references public.members (church_id, id) on delete cascade,
  foreign key (church_id, visitor_id) references public.visitors (church_id, id) on delete cascade,
  check (num_nonnulls(member_id, visitor_id, guest_name) = 1),
  constraint event_reg_member_uq unique (event_id, member_id),
  constraint event_reg_visitor_uq unique (event_id, visitor_id)
);
create index event_registrations_event_idx on public.event_registrations (church_id, event_id, status);
create trigger event_registrations_updated_at before update on public.event_registrations
  for each row execute function private.set_updated_at();
create trigger event_registrations_church_lock before update on public.event_registrations
  for each row execute function private.prevent_church_change();
create trigger event_registrations_created_by before insert on public.event_registrations
  for each row execute function private.set_actor_column('created_by');

-- Enforce open registration and capacity (serialised per event via row lock).
create or replace function private.check_event_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ev record;
  taken int;
begin
  if new.status <> 'registered' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'registered' then
    return new;
  end if;
  select e.capacity, e.registration_status, e.status into ev
    from public.events e where e.id = new.event_id for update;
  if ev.status = 'cancelled' then
    raise exception 'This event has been cancelled' using errcode = 'P0001';
  end if;
  if ev.registration_status = 'closed' then
    raise exception 'Registration for this event is closed' using errcode = 'P0001';
  end if;
  if ev.capacity is not null then
    select count(*) into taken from public.event_registrations r
      where r.event_id = new.event_id and r.status = 'registered' and r.id <> new.id;
    if taken >= ev.capacity then
      raise exception 'This event is full (capacity %)', ev.capacity using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger event_registrations_capacity before insert or update of status on public.event_registrations
  for each row execute function private.check_event_capacity();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.service_types enable row level security;
alter table public.services enable row level security;
alter table public.attendance enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;

create policy service_types_select on public.service_types for select to authenticated
  using (church_id in (select private.my_churches()));
create policy service_types_insert on public.service_types for insert to authenticated
  with check (church_id in (select private.churches_with('services.manage')));
create policy service_types_update on public.service_types for update to authenticated
  using (church_id in (select private.churches_with('services.manage')))
  with check (church_id in (select private.churches_with('services.manage')));

create policy services_select on public.services for select to authenticated using (
  church_id in (select private.churches_with('services.view'))
  or church_id in (select private.churches_with('services.manage'))
  or church_id in (select private.churches_with('attendance.record'))
);
create policy services_insert on public.services for insert to authenticated
  with check (church_id in (select private.churches_with('services.manage')));
create policy services_update on public.services for update to authenticated
  using (church_id in (select private.churches_with('services.manage')))
  with check (church_id in (select private.churches_with('services.manage')));

create policy attendance_select on public.attendance for select to authenticated using (
  church_id in (select private.churches_with('attendance.view'))
  or (recorded_by = (select auth.uid()) and church_id in (select private.churches_with('attendance.record')))
  or member_id in (select private.my_led_department_member_ids())
);
create policy attendance_insert on public.attendance for insert to authenticated
  with check (church_id in (select private.churches_with('attendance.record')));
-- Corrections: attendance.correct, or the original recorder within 12 hours.
create policy attendance_update on public.attendance for update to authenticated
  using (church_id in (select private.churches_with('attendance.correct'))
         or (recorded_by = (select auth.uid()) and created_at > now() - interval '12 hours'
             and church_id in (select private.churches_with('attendance.record'))))
  with check (church_id in (select private.churches_with('attendance.correct'))
              or church_id in (select private.churches_with('attendance.record')));

create policy events_select on public.events for select to authenticated using (
  church_id in (select private.churches_with('events.view'))
  or church_id in (select private.churches_with('events.manage'))
  or church_id in (select private.churches_with('events.checkin'))
);
create policy events_insert on public.events for insert to authenticated
  with check (church_id in (select private.churches_with('events.manage')));
create policy events_update on public.events for update to authenticated
  using (church_id in (select private.churches_with('events.manage')))
  with check (church_id in (select private.churches_with('events.manage')));

create policy event_registrations_select on public.event_registrations for select to authenticated using (
  church_id in (select private.churches_with('events.manage'))
  or church_id in (select private.churches_with('events.checkin'))
);
create policy event_registrations_insert on public.event_registrations for insert to authenticated with check (
  church_id in (select private.churches_with('events.manage'))
  or church_id in (select private.churches_with('events.checkin'))
);
create policy event_registrations_update on public.event_registrations for update to authenticated
  using (church_id in (select private.churches_with('events.manage'))
         or church_id in (select private.churches_with('events.checkin')))
  with check (church_id in (select private.churches_with('events.manage'))
              or church_id in (select private.churches_with('events.checkin')));
