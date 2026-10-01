-- ChurchX: RPC functions
-- SECURITY DEFINER functions always derive the church from the referenced
-- record (never trust a client-provided church id alone) and check
-- permissions explicitly. SECURITY INVOKER functions rely on RLS.

create or replace function private.require_any(p_church uuid, p_perms text[])
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  p text;
begin
  if private.is_trusted_context() then
    return;
  end if;
  if p_church is null then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  foreach p in array p_perms loop
    if private.has_permission(p_church, p) then
      return;
    end if;
  end loop;
  raise exception 'Permission denied' using errcode = '42501';
end $$;

create or replace function private.users_with_permission(p_church uuid, p_perm text)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select cu.user_id from public.church_users cu
  join public.role_permissions rp on rp.role_key = cu.role
  where cu.church_id = p_church and cu.status = 'active' and rp.permission = p_perm
$$;

create or replace function private.notify(
  p_church uuid, p_user uuid, p_type text, p_title text, p_body text, p_link text, p_dedupe text
) returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (church_id, user_id, type, title, body, link, dedupe_key)
  values (p_church, p_user, p_type, p_title, p_body, p_link, p_dedupe)
  on conflict (user_id, dedupe_key) do nothing
$$;

-- Notify a worker when a follow-up is assigned to them by someone else.
create or replace function private.followup_assigned_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if new.status = 'pending' and new.assigned_to is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    select coalesce(m.full_name, v.full_name) into v_name
    from (select 1) x
    left join public.members m on m.id = new.member_id
    left join public.visitors v on v.id = new.visitor_id;
    perform private.notify(new.church_id, new.assigned_to, 'followup_assigned',
      'New follow-up assigned', 'Follow up with ' || coalesce(v_name, 'a person') || ' by ' || to_char(new.due_date, 'DD Mon YYYY'),
      '/followups?view=mine', 'fu_assigned:' || new.id || ':' || new.assigned_to);
  end if;
  return null;
end $$;
create trigger followups_assigned_notify after insert or update of assigned_to on public.followups
  for each row execute function private.followup_assigned_notify();

-- Completing the last follow-up in a chain resolves the linked care alert.
create or replace function private.followup_resolve_alert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status <> 'completed'
     and new.care_alert_id is not null and new.next_followup_date is null then
    update public.member_care_alerts
       set status = 'resolved', resolution_note = 'Follow-up completed', resolved_by = auth.uid()
     where id = new.care_alert_id and status = 'open';
  end if;
  return null;
end $$;
create trigger followups_resolve_alert after update of status on public.followups
  for each row execute function private.followup_resolve_alert();

-- ---------------------------------------------------------------------------
-- Onboarding
-- ---------------------------------------------------------------------------
create or replace function public.create_church(
  p_name text,
  p_country text default null,
  p_state text default null,
  p_city text default null,
  p_address text default null,
  p_phone text default null,
  p_email text default null,
  p_website text default null,
  p_timezone text default 'Africa/Lagos',
  p_currency text default 'NGN',
  p_service_days smallint[] default '{0}'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_church uuid;
  v_slug text;
  v_count int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_name is null or char_length(trim(p_name)) < 2 then
    raise exception 'Church name is required' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown timezone' using errcode = '22023';
  end if;
  select count(*) into v_count from public.churches where created_by = v_uid;
  if v_count >= 5 then
    raise exception 'Church creation limit reached' using errcode = '42501';
  end if;

  v_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  v_slug := left(coalesce(nullif(v_slug, ''), 'church'), 48) || '-' || substr(md5(gen_random_uuid()::text), 1, 6);

  insert into public.churches (name, slug, country, state, city, address, phone, email, website, timezone, currency, created_by)
  values (trim(p_name), v_slug, nullif(trim(p_country), ''), nullif(trim(p_state), ''), nullif(trim(p_city), ''),
          nullif(trim(p_address), ''), nullif(trim(p_phone), ''), nullif(lower(trim(p_email)), ''),
          nullif(trim(p_website), ''), p_timezone, upper(p_currency), v_uid)
  returning id into v_church;

  insert into public.church_settings (church_id, default_service_days)
  values (v_church, coalesce(p_service_days, '{0}'));

  insert into public.church_users (church_id, user_id, role, status, activated_at)
  values (v_church, v_uid, 'church_admin', 'active', now());

  insert into public.service_types (church_id, name, default_day, default_start_time, default_end_time, include_in_care) values
    (v_church, 'Sunday Service', 0, '09:00', '11:30', true),
    (v_church, 'Midweek Service', 3, '18:00', '19:30', true),
    (v_church, 'Prayer Meeting', null, '18:00', '19:00', false),
    (v_church, 'Vigil', 5, '22:00', null, false),
    (v_church, 'Youth Service', null, null, null, false),
    (v_church, 'Special Programme', null, null, null, false);

  insert into public.giving_categories (church_id, name, sort_order) values
    (v_church, 'Tithe', 1), (v_church, 'Offering', 2), (v_church, 'Thanksgiving', 3),
    (v_church, 'Project', 4), (v_church, 'Donation', 5), (v_church, 'Seed', 6), (v_church, 'Other', 7);

  return v_church;
end $$;

create or replace function public.accept_invitations()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if auth.uid() is null then
    return 0;
  end if;
  update public.church_users
     set status = 'active', activated_at = now()
   where user_id = auth.uid() and status = 'invited';
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.my_permissions(p_church uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct p.key order by p.key), '{}')
  from public.permissions p
  where private.is_super_admin()
     or exists (select 1 from public.church_users cu
                join public.role_permissions rp on rp.role_key = cu.role
                where cu.church_id = p_church and cu.user_id = auth.uid()
                  and cu.status = 'active' and rp.permission = p.key)
$$;

-- ---------------------------------------------------------------------------
-- People lookup without contact details (for pickers & check-in)
-- ---------------------------------------------------------------------------
create or replace function public.lookup_people(
  p_church uuid, p_query text, p_kind text default 'all', p_limit int default 10
) returns table (id uuid, kind text, full_name text, membership_number text, status text, photo_path text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  q text := '%' || lower(regexp_replace(coalesce(trim(p_query), ''), '([%_\\])', '\\\1', 'g')) || '%';
  lim int := least(greatest(coalesce(p_limit, 10), 1), 50);
begin
  perform private.require_any(p_church, array['members.view', 'members.manage', 'giving.manage', 'followups.manage',
    'events.manage', 'events.checkin', 'departments.manage', 'attendance.record', 'care.manage', 'visitors.manage']);
  return query
  (select m.id, 'member'::text, m.full_name, m.membership_number, m.membership_status, m.photo_path
     from public.members m
    where m.church_id = p_church and p_kind in ('all', 'member')
      and m.membership_status not in ('archived', 'transferred')
      and lower(m.full_name || ' ' || coalesce(m.membership_number, '')) like q
    order by m.first_name, m.last_name limit lim)
  union all
  (select v.id, 'visitor'::text, v.full_name, null::text, v.status, null::text
     from public.visitors v
    where v.church_id = p_church and p_kind in ('all', 'visitor')
      and v.status <> 'converted'
      and lower(v.full_name) like q
    order by v.visit_date desc limit lim);
end $$;

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------
create or replace function public.checkin_search(
  p_service uuid, p_query text default '', p_limit int default 25, p_offset int default 0
) returns table (person_id uuid, kind text, full_name text, membership_number text, photo_path text,
                 attendance_id uuid, attendance_status text, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_church uuid;
  q text := '%' || lower(regexp_replace(coalesce(trim(p_query), ''), '([%_\\])', '\\\1', 'g')) || '%';
begin
  select s.church_id into v_church from public.services s where s.id = p_service;
  perform private.require_any(v_church, array['attendance.record', 'attendance.correct']);
  return query
  with people as (
    select m.id as pid, 'member'::text as k, m.full_name as fn, m.membership_number as mn, m.photo_path as ph,
           m.first_name as sort1, m.last_name as sort2
      from public.members m
     where m.church_id = v_church and m.membership_status not in ('archived', 'transferred')
       and m.search_text like q
    union all
    select v.id, 'visitor', v.full_name, null, null, v.first_name, coalesce(v.last_name, '')
      from public.visitors v
     where v.church_id = v_church and v.status <> 'converted' and v.search_text like q
       and (coalesce(trim(p_query), '') <> '' or v.service_id = p_service
            or exists (select 1 from public.attendance a2 where a2.service_id = p_service and a2.visitor_id = v.id))
  )
  select p.pid, p.k, p.fn, p.mn, p.ph, a.id, a.status, count(*) over ()
    from people p
    left join public.attendance a on a.service_id = p_service
         and ((p.k = 'member' and a.member_id = p.pid) or (p.k = 'visitor' and a.visitor_id = p.pid))
   order by p.sort1, p.sort2
   limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;

create or replace function public.service_attendance_list(p_service uuid)
returns table (attendance_id uuid, kind text, person_id uuid, full_name text, membership_number text,
               status text, checked_in_at timestamptz, method text, notes text, recorded_by_name text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_church uuid;
begin
  select s.church_id into v_church from public.services s where s.id = p_service;
  perform private.require_any(v_church, array['attendance.view', 'attendance.record']);
  return query
  select a.id,
         case when a.member_id is not null then 'member' else 'visitor' end,
         coalesce(a.member_id, a.visitor_id),
         coalesce(m.full_name, v.full_name),
         m.membership_number,
         a.status, a.checked_in_at, a.method,
         case when private.has_permission(v_church, 'attendance.view') then a.notes end,
         pr.full_name
    from public.attendance a
    left join public.members m on m.id = a.member_id
    left join public.visitors v on v.id = a.visitor_id
    left join public.profiles pr on pr.id = a.recorded_by
   where a.service_id = p_service
   order by a.checked_in_at desc;
end $$;

-- Bulk check-in. Runs as the caller, so RLS enforces attendance.record.
create or replace function public.bulk_mark_attendance(
  p_service uuid, p_member_ids uuid[], p_status text default 'present'
) returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_church uuid;
  n int;
begin
  select s.church_id into v_church from public.services s where s.id = p_service;
  if v_church is null then
    raise exception 'Service not found' using errcode = 'P0002';
  end if;
  if p_status not in ('present', 'absent', 'excused') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  if coalesce(array_length(p_member_ids, 1), 0) > 1000 then
    raise exception 'Too many people in one batch (max 1000)' using errcode = '22023';
  end if;
  insert into public.attendance (church_id, service_id, member_id, status, method)
  select v_church, p_service, mid, p_status, 'bulk'
    from unnest(p_member_ids) as mid
  on conflict on constraint attendance_service_member_uq do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Visitor → member conversion (keeps visitor + follow-up history)
-- ---------------------------------------------------------------------------
create or replace function public.convert_visitor_to_member(p_visitor uuid, p_member jsonb default '{}'::jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v record;
  v_member uuid;
begin
  select * into v from public.visitors where id = p_visitor for update;
  if not found then
    raise exception 'Visitor not found' using errcode = 'P0002';
  end if;
  if v.status = 'converted' then
    raise exception 'This visitor has already been converted' using errcode = 'P0001';
  end if;

  insert into public.members (church_id, first_name, middle_name, last_name, gender, phone, email, address,
                              city, state, country, date_of_birth, marital_status, occupation, membership_status, join_date)
  values (
    v.church_id,
    coalesce(nullif(trim(p_member ->> 'first_name'), ''), v.first_name),
    nullif(trim(p_member ->> 'middle_name'), ''),
    coalesce(nullif(trim(p_member ->> 'last_name'), ''), nullif(trim(v.last_name), ''), '-'),
    coalesce(nullif(p_member ->> 'gender', ''), v.gender),
    coalesce(nullif(p_member ->> 'phone', ''), v.phone),
    coalesce(nullif(p_member ->> 'email', ''), v.email),
    coalesce(nullif(p_member ->> 'address', ''), v.address),
    nullif(p_member ->> 'city', ''),
    nullif(p_member ->> 'state', ''),
    nullif(p_member ->> 'country', ''),
    nullif(p_member ->> 'date_of_birth', '')::date,
    nullif(p_member ->> 'marital_status', ''),
    nullif(p_member ->> 'occupation', ''),
    coalesce(nullif(p_member ->> 'membership_status', ''), 'new_member'),
    coalesce(nullif(p_member ->> 'join_date', '')::date, private.church_today(v.church_id))
  ) returning id into v_member;

  update public.visitors
     set status = 'converted', converted_member_id = v_member, converted_at = now()
   where id = p_visitor;

  -- Carry history across so the member profile shows it.
  update public.followups set member_id = v_member where visitor_id = p_visitor and member_id is null;
  update public.event_registrations set member_id = v_member, visitor_id = null
   where visitor_id = p_visitor
     and not exists (select 1 from public.event_registrations r2 where r2.event_id = event_registrations.event_id and r2.member_id = v_member);

  return v_member;
end $$;

-- ---------------------------------------------------------------------------
-- Follow-ups
-- ---------------------------------------------------------------------------
create or replace function public.assign_followups(
  p_church uuid, p_assignee uuid, p_member_ids uuid[] default '{}', p_visitor_ids uuid[] default '{}',
  p_due date default null, p_notes text default null, p_care_alert uuid default null
) returns integer language plpgsql security invoker set search_path = '' as $$
declare
  n int := 0;
  k int;
  v_due date := coalesce(p_due, private.church_today(p_church));
begin
  insert into public.followups (church_id, member_id, assigned_to, assigned_by, due_date, notes, care_alert_id)
  select p_church, mid, p_assignee, auth.uid(), v_due, p_notes, p_care_alert from unnest(coalesce(p_member_ids, '{}')) mid;
  get diagnostics k = row_count; n := n + k;
  insert into public.followups (church_id, visitor_id, assigned_to, assigned_by, due_date, notes, care_alert_id)
  select p_church, vid, p_assignee, auth.uid(), v_due, p_notes, p_care_alert from unnest(coalesce(p_visitor_ids, '{}')) vid;
  get diagnostics k = row_count; n := n + k;
  if p_care_alert is not null then
    update public.member_care_alerts set assigned_to = p_assignee where id = p_care_alert;
  end if;
  return n;
end $$;

create or replace function public.complete_followup(
  p_followup uuid, p_contact_method text, p_outcome text, p_notes text default null,
  p_next_date date default null, p_visitor_status text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  f record;
  v_next uuid;
begin
  select * into f from public.followups where id = p_followup for update;
  if not found then
    raise exception 'Follow-up not found' using errcode = 'P0002';
  end if;
  if f.status <> 'pending' then
    raise exception 'This follow-up is already %', f.status using errcode = 'P0001';
  end if;

  update public.followups
     set status = 'completed', contact_method = p_contact_method, outcome = p_outcome,
         notes = coalesce(nullif(trim(p_notes), ''), notes), next_followup_date = p_next_date,
         completed_at = now(), completed_by = auth.uid()
   where id = p_followup;

  if p_next_date is not null then
    insert into public.followups (church_id, member_id, visitor_id, assigned_to, assigned_by, due_date, parent_id, care_alert_id)
    values (f.church_id, f.member_id, f.visitor_id, f.assigned_to, auth.uid(), p_next_date, f.id, f.care_alert_id)
    returning id into v_next;
  end if;

  if f.visitor_id is not null then
    update public.visitors
       set status = coalesce(nullif(p_visitor_status, ''),
                             case when status = 'new' then 'contacted' else status end)
     where id = f.visitor_id and status <> 'converted';
  end if;

  return v_next;
end $$;

-- ---------------------------------------------------------------------------
-- Member care engine
-- ---------------------------------------------------------------------------
create or replace function public.refresh_member_care(p_church uuid, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_today date;
  r jsonb;
  v_last timestamptz;
  n_new int := 0;
  k int;
  u uuid;
  v_abs int;
  v_long int;
  v_vdays int;
  v_drop numeric;
  v_look int;
  v_nodept int;
begin
  if not private.is_trusted_context() and not private.is_church_member(p_church) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  select s.care_rules, s.care_refreshed_at into r, v_last
    from public.church_settings s where s.church_id = p_church for update;
  if r is null then
    raise exception 'Church not found' using errcode = 'P0002';
  end if;
  if not p_force and v_last is not null and v_last > now() - interval '10 minutes' then
    return jsonb_build_object('skipped', true, 'refreshed_at', v_last);
  end if;

  v_today := private.church_today(p_church);
  v_abs := greatest(coalesce((r ->> 'absent_consecutive')::int, 2), 1);
  v_long := greatest(coalesce((r ->> 'absent_long')::int, 4), v_abs + 1);
  v_vdays := greatest(coalesce((r ->> 'visitor_contact_days')::int, 2), 0);
  v_drop := least(greatest(coalesce((r ->> 'attendance_drop_pct')::numeric, 50), 10), 100);
  v_look := least(greatest(coalesce((r ->> 'birthday_lookahead_days')::int, 7), 1), 31);
  v_nodept := greatest(coalesce((r ->> 'no_department_after_days')::int, 14), 0);

  create temp table if not exists _care (
    alert_type text, member_id uuid, visitor_id uuid, followup_id uuid, period_key text, details jsonb
  ) on commit drop;
  truncate _care;

  -- Absence streaks over care-eligible services
  with svc as (
    select s.id, s.service_date
      from public.services s left join public.service_types t on t.id = s.service_type_id
     where s.church_id = p_church and s.status <> 'cancelled'
       and s.service_date <= v_today and s.service_date > v_today - 180
       and coalesce(t.include_in_care, true)
  ), mem as (
    select m.id, m.join_date,
           (select max(sv.service_date) from public.attendance a join svc sv on sv.id = a.service_id
             where a.member_id = m.id and a.status in ('present', 'excused')) as last_present
      from public.members m
     where m.church_id = p_church and m.membership_status in ('active', 'new_member')
  ), streak as (
    select mem.id, mem.last_present,
           (select count(*) from svc
             where svc.service_date >= mem.join_date
               and svc.service_date > coalesce(mem.last_present, mem.join_date - 1)) as misses
      from mem
  )
  insert into _care (alert_type, member_id, period_key, details)
  select case when misses >= v_long then 'absent_long' else 'absent_consecutive' end,
         id, 'since:' || coalesce(last_present::text, 'join'),
         jsonb_build_object('missed', misses, 'last_present', last_present)
    from streak where misses >= v_abs;

  -- Attendance drop: last 4 weeks vs the 8 weeks before
  with svc as (
    select s.id, s.service_date
      from public.services s left join public.service_types t on t.id = s.service_type_id
     where s.church_id = p_church and s.status <> 'cancelled'
       and s.service_date <= v_today and s.service_date > v_today - 84
       and coalesce(t.include_in_care, true)
  ), rates as (
    select m.id,
           count(*) filter (where sv.service_date > v_today - 28) as recent_svc,
           count(*) filter (where sv.service_date > v_today - 28 and a.id is not null) as recent_att,
           count(*) filter (where sv.service_date <= v_today - 28) as prev_svc,
           count(*) filter (where sv.service_date <= v_today - 28 and a.id is not null) as prev_att
      from public.members m
      join svc sv on sv.service_date >= m.join_date
      left join public.attendance a on a.service_id = sv.id and a.member_id = m.id and a.status = 'present'
     where m.church_id = p_church and m.membership_status in ('active', 'new_member')
     group by m.id
  )
  insert into _care (alert_type, member_id, period_key, details)
  select 'attendance_drop', id, to_char(v_today, 'IYYY-IW'),
         jsonb_build_object('recent_rate', round(recent_att::numeric / recent_svc * 100),
                            'previous_rate', round(prev_att::numeric / prev_svc * 100))
    from rates
   where recent_svc >= 2 and prev_svc >= 3
     and prev_att::numeric / prev_svc >= 0.5
     and (recent_att::numeric / recent_svc) <= (prev_att::numeric / prev_svc) * (1 - v_drop / 100)
     and not exists (select 1 from _care c where c.member_id = rates.id);

  -- Visitors not contacted
  insert into _care (alert_type, visitor_id, period_key, details)
  select 'visitor_not_contacted', v.id, 'visit:' || v.visit_date,
         jsonb_build_object('visit_date', v.visit_date, 'days', v_today - v.visit_date)
    from public.visitors v
   where v.church_id = p_church and v.status = 'new' and v.visit_date <= v_today - v_vdays;

  -- Overdue follow-ups
  insert into _care (alert_type, member_id, visitor_id, followup_id, period_key, details)
  select 'followup_overdue', f.member_id, case when f.member_id is null then f.visitor_id end, f.id, 'fu:' || f.id,
         jsonb_build_object('due_date', f.due_date, 'days_overdue', v_today - f.due_date, 'assigned_to', f.assigned_to)
    from public.followups f
   where f.church_id = p_church and f.status = 'pending' and f.due_date < v_today;

  -- Birthdays
  with b as (
    select m.id, m.date_of_birth,
           (m.date_of_birth + make_interval(years => extract(year from age(v_today, m.date_of_birth))::int))::date as last_bd,
           (m.date_of_birth + make_interval(years => extract(year from age(v_today, m.date_of_birth))::int + 1))::date as next_bd
      from public.members m
     where m.church_id = p_church and m.date_of_birth is not null and m.date_of_birth <= v_today
       and m.membership_status in ('active', 'new_member', 'inactive')
  )
  insert into _care (alert_type, member_id, period_key, details)
  select case when last_bd = v_today then 'birthday_today' else 'birthday_week' end,
         id, extract(year from case when last_bd = v_today then last_bd else next_bd end)::text,
         jsonb_build_object('birthday', case when last_bd = v_today then last_bd else next_bd end,
                            'age', extract(year from age(case when last_bd = v_today then last_bd else next_bd end, date_of_birth)))
    from b
   where last_bd = v_today or (next_bd - v_today) between 1 and v_look;

  -- New members without a department
  insert into _care (alert_type, member_id, period_key, details)
  select 'no_department', m.id, 'once', jsonb_build_object('join_date', m.join_date)
    from public.members m
   where m.church_id = p_church
     and (m.membership_status = 'new_member' or (m.membership_status = 'active' and m.join_date > v_today - 90))
     and m.join_date <= v_today - v_nodept
     and not exists (select 1 from public.department_members dm where dm.member_id = m.id and dm.left_on is null);

  -- Upsert: new alerts are created, existing open ones refreshed.
  insert into public.member_care_alerts (church_id, alert_type, member_id, visitor_id, followup_id, period_key, details)
  select p_church, c.alert_type, c.member_id, c.visitor_id, c.followup_id, c.period_key, c.details from _care c
  on conflict (church_id, alert_type, coalesce(member_id, visitor_id), period_key)
  do update set details = excluded.details
  where public.member_care_alerts.status = 'open';
  get diagnostics k = row_count;

  select count(*) into n_new from public.member_care_alerts a
   where a.church_id = p_church and a.status = 'open' and a.created_at = now();

  -- Close alerts whose condition no longer holds.
  update public.member_care_alerts a set status = 'auto_resolved', resolution_note = 'Condition no longer applies'
   where a.church_id = p_church and a.status = 'open'
     and not exists (select 1 from _care c where c.alert_type = a.alert_type
                       and coalesce(c.member_id, c.visitor_id) = coalesce(a.member_id, a.visitor_id)
                       and c.period_key = a.period_key);

  -- Notifications (in-app only)
  perform private.notify(p_church, f.assigned_to, 'followup_due', 'Follow-up due today',
            'Follow up with ' || coalesce(m.full_name, v.full_name), '/followups?view=today',
            'fu_due:' || f.id || ':' || v_today)
     from public.followups f
     left join public.members m on m.id = f.member_id
     left join public.visitors v on v.id = f.visitor_id
    where f.church_id = p_church and f.status = 'pending' and f.due_date = v_today;

  perform private.notify(p_church, f.assigned_to, 'followup_overdue', 'Follow-up overdue',
            coalesce(m.full_name, v.full_name) || ' was due on ' || to_char(f.due_date, 'DD Mon'), '/followups?view=overdue',
            'fu_overdue:' || f.id)
     from public.followups f
     left join public.members m on m.id = f.member_id
     left join public.visitors v on v.id = f.visitor_id
    where f.church_id = p_church and f.status = 'pending' and f.due_date < v_today;

  for u in select private.users_with_permission(p_church, 'care.view') loop
    perform private.notify(p_church, u, 'birthday', 'Birthday today', m.full_name || ' celebrates a birthday today',
              '/members/' || m.id, 'bday:' || m.id || ':' || extract(year from v_today))
       from _care c join public.members m on m.id = c.member_id
      where c.alert_type = 'birthday_today';
    if n_new > 0 then
      perform private.notify(p_church, u, 'care_alert', 'Member care: ' || n_new || ' new alert' || case when n_new > 1 then 's' else '' end,
                'People may need attention', '/care', 'care:' || v_today || ':' || n_new);
    end if;
  end loop;

  for u in select private.users_with_permission(p_church, 'events.view') union select private.users_with_permission(p_church, 'events.manage') loop
    perform private.notify(p_church, u, 'event_upcoming', 'Upcoming event: ' || e.name,
              'Starts ' || to_char(e.start_date, 'Dy DD Mon'), '/events/' || e.id, 'event:' || e.id)
       from public.events e
      where e.church_id = p_church and e.status = 'scheduled'
        and e.start_date between v_today and v_today + 3;
  end loop;

  update public.church_settings set care_refreshed_at = now() where church_id = p_church;
  return jsonb_build_object('skipped', false, 'open_alerts',
    (select count(*) from public.member_care_alerts a where a.church_id = p_church and a.status = 'open'),
    'new_alerts', n_new);
end $$;

create or replace function public.member_care_summary(p_church uuid)
returns table (alert_type text, open_count bigint)
language sql stable security invoker set search_path = '' as $$
  select a.alert_type, count(*) from public.member_care_alerts a
   where a.church_id = p_church and a.status = 'open'
   group by a.alert_type
$$;

-- ---------------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_summary(p_church uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date;
  v_week date;
  v_month date;
  res jsonb := '{}'::jsonb;
begin
  if not private.is_church_member(p_church) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  v_today := private.church_today(p_church);
  v_week := date_trunc('week', v_today)::date;
  v_month := date_trunc('month', v_today)::date;

  if private.has_permission(p_church, 'members.view') or private.has_permission(p_church, 'reports.view') then
    res := res || (
      select jsonb_build_object(
        'total_members', count(*) filter (where m.membership_status not in ('archived', 'transferred', 'visitor')),
        'active_members', count(*) filter (where m.membership_status = 'active'),
        'new_members_month', count(*) filter (where m.join_date >= v_month and m.membership_status not in ('archived', 'transferred')))
      from public.members m where m.church_id = p_church);
  end if;

  if private.has_permission(p_church, 'visitors.view') or private.has_permission(p_church, 'reports.view') then
    res := res || (
      select jsonb_build_object(
        'visitors_month', count(*) filter (where v.visit_date >= v_month),
        'visitors_awaiting', count(*) filter (where v.status = 'new'))
      from public.visitors v where v.church_id = p_church);
  end if;

  if private.has_permission(p_church, 'attendance.view') or private.has_permission(p_church, 'reports.view') then
    res := res || jsonb_build_object(
      'attendance_week', (select count(*) from public.attendance a join public.services s on s.id = a.service_id
                           where a.church_id = p_church and a.status = 'present'
                             and s.service_date between v_week and v_week + 6),
      'attendance_last_week', (select count(*) from public.attendance a join public.services s on s.id = a.service_id
                           where a.church_id = p_church and a.status = 'present'
                             and s.service_date between v_week - 7 and v_week - 1));
  end if;

  if private.has_permission(p_church, 'services.view') or private.has_permission(p_church, 'attendance.record') then
    res := res || jsonb_build_object('upcoming_services', coalesce((
      select jsonb_agg(x order by x.service_date, x.start_time) from (
        select s.id, s.name, s.service_date, s.start_time, s.status from public.services s
         where s.church_id = p_church and s.service_date >= v_today and s.status in ('scheduled', 'ongoing')
         order by s.service_date, s.start_time limit 5) x), '[]'::jsonb));
  end if;

  if private.has_permission(p_church, 'events.view') or private.has_permission(p_church, 'events.manage') then
    res := res || jsonb_build_object('upcoming_events', coalesce((
      select jsonb_agg(x order by x.start_date) from (
        select e.id, e.name, e.start_date, e.end_date, e.venue from public.events e
         where e.church_id = p_church and e.end_date >= v_today and e.status = 'scheduled'
         order by e.start_date limit 5) x), '[]'::jsonb));
  end if;

  if private.has_permission(p_church, 'care.view') then
    res := res || jsonb_build_object('needs_attention', (
      select count(distinct coalesce(a.member_id, a.visitor_id)) from public.member_care_alerts a
       where a.church_id = p_church and a.status = 'open'));
  end if;

  if private.has_permission(p_church, 'giving.view') then
    res := res || (
      select jsonb_build_object(
        'giving_month', coalesce(sum(c.amount) filter (where c.contribution_date >= v_month), 0),
        'giving_prev_month', coalesce(sum(c.amount) filter (where c.contribution_date >= (v_month - interval '1 month')::date
                                                           and c.contribution_date < v_month), 0))
      from public.contributions c
     where c.church_id = p_church and c.status = 'recorded'
       and c.contribution_date >= (v_month - interval '1 month')::date);
  end if;

  res := res || (
    select jsonb_build_object(
      'my_followups_today', count(*) filter (where f.due_date = v_today),
      'my_followups_overdue', count(*) filter (where f.due_date < v_today))
    from public.followups f
   where f.church_id = p_church and f.assigned_to = auth.uid() and f.status = 'pending');

  return res || jsonb_build_object('today', v_today);
end $$;

-- ---------------------------------------------------------------------------
-- Member overview (runs as caller → RLS applies)
-- ---------------------------------------------------------------------------
create or replace function public.member_overview(p_member uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  m record;
  v_today date;
  v_total int;
  v_present int;
  v_last date;
begin
  select id, church_id, join_date, date_of_birth into m from public.members where id = p_member;
  if not found then
    return null;
  end if;
  v_today := private.church_today(m.church_id);
  select count(*) into v_total from public.services s
    left join public.service_types t on t.id = s.service_type_id
   where s.church_id = m.church_id and s.status <> 'cancelled' and s.service_date between m.join_date and v_today
     and coalesce(t.include_in_care, true) and s.service_date > v_today - 365;
  select count(*) filter (where a.status = 'present' and s.service_date > v_today - 365 and coalesce(t.include_in_care, true)),
         max(s.service_date) filter (where a.status = 'present')
    into v_present, v_last
    from public.attendance a join public.services s on s.id = a.service_id
    left join public.service_types t on t.id = s.service_type_id
   where a.member_id = p_member;
  return jsonb_build_object(
    'services_considered', v_total,
    'services_attended', v_present,
    'attendance_pct', case when v_total > 0 then round(least(v_present, v_total)::numeric / v_total * 100) end,
    'last_attendance', v_last,
    'membership_days', v_today - m.join_date,
    'next_birthday', case when m.date_of_birth is not null then
        case when (m.date_of_birth + make_interval(years => extract(year from age(v_today, m.date_of_birth))::int))::date = v_today
             then v_today
             else (m.date_of_birth + make_interval(years => extract(year from age(v_today, m.date_of_birth))::int + 1))::date end
      end
  );
end $$;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create or replace function private.valid_bucket(p_bucket text)
returns text language sql immutable set search_path = '' as $$
  select case when p_bucket in ('day', 'week', 'month') then p_bucket else 'week' end
$$;

create or replace function public.report_attendance(
  p_church uuid, p_from date, p_to date, p_bucket text default 'week',
  p_service_type uuid default null, p_department uuid default null, p_member_status text default null
) returns table (period date, services bigint, present bigint, visitors bigint, avg_per_service numeric)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  b text := private.valid_bucket(p_bucket);
begin
  perform private.require_any(p_church, array['reports.view', 'attendance.view']);
  if p_to - p_from > 1100 then
    raise exception 'Date range too large (max 3 years)' using errcode = '22023';
  end if;
  return query
  with svc as (
    select s.id, date_trunc(b, s.service_date)::date as per
      from public.services s
     where s.church_id = p_church and s.status <> 'cancelled'
       and s.service_date between p_from and p_to
       and (p_service_type is null or s.service_type_id = p_service_type)
  ), att as (
    select a.service_id, a.member_id, a.visitor_id
      from public.attendance a
      join svc on svc.id = a.service_id
      left join public.members m on m.id = a.member_id
     where a.status = 'present'
       and (p_member_status is null or m.membership_status = p_member_status)
       and (p_department is null or exists (select 1 from public.department_members dm
                                            where dm.member_id = a.member_id and dm.department_id = p_department
                                              and dm.left_on is null))
  )
  select svc.per,
         count(distinct svc.id),
         count(att.member_id) + count(att.visitor_id),
         count(att.visitor_id),
         round((count(att.member_id) + count(att.visitor_id))::numeric / nullif(count(distinct svc.id), 0), 1)
    from svc left join att on att.service_id = svc.id
   group by svc.per order by svc.per;
end $$;

create or replace function public.report_service_attendance(
  p_church uuid, p_from date, p_to date, p_service_type uuid default null,
  p_department uuid default null, p_member_status text default null
) returns table (service_id uuid, service_name text, service_date date, service_status text,
                 present bigint, absent bigint, excused bigint, visitors bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.require_any(p_church, array['reports.view', 'attendance.view']);
  return query
  select s.id, s.name, s.service_date, s.status,
         count(*) filter (where a.status = 'present' and a.member_id is not null),
         count(*) filter (where a.status = 'absent'),
         count(*) filter (where a.status = 'excused'),
         count(*) filter (where a.status = 'present' and a.visitor_id is not null)
    from public.services s
    left join public.attendance a on a.service_id = s.id
         and (p_member_status is null or exists (select 1 from public.members m where m.id = a.member_id and m.membership_status = p_member_status))
         and (p_department is null or exists (select 1 from public.department_members dm where dm.member_id = a.member_id
                                              and dm.department_id = p_department and dm.left_on is null))
   where s.church_id = p_church and s.service_date between p_from and p_to
     and (p_service_type is null or s.service_type_id = p_service_type)
   group by s.id order by s.service_date desc, s.start_time desc nulls last
   limit 500;
end $$;

create or replace function public.report_member_growth(p_church uuid, p_from date, p_to date, p_bucket text default 'month')
returns table (period date, new_members bigint, total_members bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  b text := private.valid_bucket(p_bucket);
begin
  perform private.require_any(p_church, array['reports.view']);
  return query
  with periods as (
    select generate_series(date_trunc(b, p_from), date_trunc(b, p_to), ('1 ' || b)::interval)::date as per
  )
  select p.per,
         (select count(*) from public.members m where m.church_id = p_church
             and m.membership_status not in ('visitor')
             and m.join_date >= p.per and m.join_date < (p.per + ('1 ' || b)::interval)::date),
         (select count(*) from public.members m where m.church_id = p_church
             and m.membership_status not in ('visitor', 'archived', 'transferred')
             and m.join_date < (p.per + ('1 ' || b)::interval)::date)
    from periods p order by p.per;
end $$;

create or replace function public.report_visitors(p_church uuid, p_from date, p_to date, p_bucket text default 'month')
returns table (period date, visitors bigint, converted bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  b text := private.valid_bucket(p_bucket);
begin
  perform private.require_any(p_church, array['reports.view']);
  return query
  with periods as (
    select generate_series(date_trunc(b, p_from), date_trunc(b, p_to), ('1 ' || b)::interval)::date as per
  )
  select p.per,
         count(v.id),
         count(v.id) filter (where v.status = 'converted')
    from periods p
    left join public.visitors v on v.church_id = p_church
         and v.visit_date >= p.per and v.visit_date < (p.per + ('1 ' || b)::interval)::date
   group by p.per order by p.per;
end $$;

create or replace function public.report_followup_performance(p_church uuid, p_from date, p_to date)
returns table (user_id uuid, worker_name text, assigned bigint, completed bigint, pending bigint, overdue bigint, completion_rate numeric)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_today date := private.church_today(p_church);
begin
  perform private.require_any(p_church, array['reports.view', 'followups.view_all']);
  return query
  select f.assigned_to, coalesce(pr.full_name, pr.email, 'Unknown'),
         count(*),
         count(*) filter (where f.status = 'completed'),
         count(*) filter (where f.status = 'pending'),
         count(*) filter (where f.status = 'pending' and f.due_date < v_today),
         round(count(*) filter (where f.status = 'completed')::numeric / nullif(count(*) filter (where f.status <> 'cancelled'), 0) * 100, 1)
    from public.followups f
    left join public.profiles pr on pr.id = f.assigned_to
   where f.church_id = p_church and f.due_date between p_from and p_to
   group by f.assigned_to, pr.full_name, pr.email
   order by count(*) desc;
end $$;

create or replace function public.report_department_membership(p_church uuid)
returns table (department_id uuid, name text, status text, active_members bigint, leader_name text, joined_90d bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.require_any(p_church, array['reports.view', 'departments.view', 'departments.manage']);
  return query
  select d.id, d.name, d.status,
         count(dm.id) filter (where dm.left_on is null),
         l.full_name,
         count(dm.id) filter (where dm.joined_on > private.church_today(p_church) - 90)
    from public.departments d
    left join public.department_members dm on dm.department_id = d.id
    left join public.members l on l.id = d.leader_member_id
   where d.church_id = p_church
   group by d.id, l.full_name order by d.name;
end $$;

-- Retention: share of members attending regularly over the last 8 services.
create or replace function public.report_retention(p_church uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := private.church_today(p_church);
  res jsonb;
begin
  perform private.require_any(p_church, array['reports.view']);
  with svc as (
    select s.id from public.services s left join public.service_types t on t.id = s.service_type_id
     where s.church_id = p_church and s.status <> 'cancelled' and s.service_date <= v_today
       and coalesce(t.include_in_care, true)
     order by s.service_date desc limit 8
  ), per as (
    select m.id, count(a.id) as attended
      from public.members m
      left join public.attendance a on a.member_id = m.id and a.status = 'present' and a.service_id in (select id from svc)
     where m.church_id = p_church and m.membership_status in ('active', 'new_member', 'inactive')
     group by m.id
  )
  select jsonb_build_object(
    'services_window', (select count(*) from svc),
    'members', count(*),
    'regular', count(*) filter (where attended >= 6),
    'occasional', count(*) filter (where attended between 2 and 5),
    'rare', count(*) filter (where attended = 1),
    'none', count(*) filter (where attended = 0)
  ) into res from per;
  return res;
end $$;

create or replace function public.report_giving_summary(p_church uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := private.church_today(p_church);
  v_week date := date_trunc('week', v_today)::date;
  v_month date := date_trunc('month', v_today)::date;
  v_prev date := (date_trunc('month', v_today) - interval '1 month')::date;
  res jsonb;
begin
  perform private.require_any(p_church, array['giving.view', 'reports.finance']);
  select jsonb_build_object(
    'currency', (select c.currency from public.churches c where c.id = p_church),
    'today', coalesce(sum(amount) filter (where contribution_date = v_today), 0),
    'week', coalesce(sum(amount) filter (where contribution_date >= v_week), 0),
    'month', coalesce(sum(amount) filter (where contribution_date >= v_month), 0),
    'prev_month', coalesce(sum(amount) filter (where contribution_date >= v_prev and contribution_date < v_month), 0),
    'year', coalesce(sum(amount) filter (where contribution_date >= date_trunc('year', v_today)::date), 0),
    'count_month', count(*) filter (where contribution_date >= v_month)
  ) into res
  from public.contributions
  where church_id = p_church and status = 'recorded'
    and contribution_date >= least(v_prev, date_trunc('year', v_today)::date) and contribution_date <= v_today;
  return res;
end $$;

create or replace function public.report_giving_trend(p_church uuid, p_from date, p_to date, p_bucket text default 'month')
returns table (period date, total numeric, contributions bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  b text := private.valid_bucket(p_bucket);
begin
  perform private.require_any(p_church, array['giving.view', 'reports.finance']);
  return query
  with periods as (
    select generate_series(date_trunc(b, p_from), date_trunc(b, p_to), ('1 ' || b)::interval)::date as per
  )
  select p.per, coalesce(sum(c.amount), 0), count(c.id)
    from periods p
    left join public.contributions c on c.church_id = p_church and c.status = 'recorded'
         and c.contribution_date >= p.per and c.contribution_date < (p.per + ('1 ' || b)::interval)::date
         and c.contribution_date between p_from and p_to
   group by p.per order by p.per;
end $$;

create or replace function public.report_giving_breakdown(p_church uuid, p_from date, p_to date, p_by text default 'category')
returns table (label text, total numeric, contributions bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.require_any(p_church, array['giving.view', 'reports.finance']);
  if p_by = 'method' then
    return query
    select c.payment_method, sum(c.amount), count(*)
      from public.contributions c
     where c.church_id = p_church and c.status = 'recorded' and c.contribution_date between p_from and p_to
     group by c.payment_method order by sum(c.amount) desc;
  else
    return query
    select g.name, sum(c.amount), count(*)
      from public.contributions c join public.giving_categories g on g.id = c.category_id
     where c.church_id = p_church and c.status = 'recorded' and c.contribution_date between p_from and p_to
     group by g.name order by sum(c.amount) desc;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Global search (runs as caller → results respect RLS)
-- ---------------------------------------------------------------------------
create or replace function public.global_search(p_church uuid, p_query text)
returns table (kind text, id uuid, title text, subtitle text, href text)
language plpgsql stable security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  q text := '%' || lower(regexp_replace(coalesce(trim(p_query), ''), '([%_\\])', '\\\1', 'g')) || '%';
begin
  if char_length(coalesce(trim(p_query), '')) < 2 then
    return;
  end if;
  return query
  (select 'member'::text, m.id, m.full_name, coalesce(m.membership_number, '') || ' · ' || replace(m.membership_status, '_', ' '),
          '/members/' || m.id
     from public.members m where m.church_id = p_church and m.search_text like q
    order by m.membership_status = 'archived', m.first_name limit 6)
  union all
  (select 'visitor', v.id, v.full_name, 'Visitor · ' || to_char(v.visit_date, 'DD Mon YYYY'), '/visitors/' || v.id
     from public.visitors v where v.church_id = p_church and v.search_text like q
    order by v.visit_date desc limit 5)
  union all
  (select 'department', d.id, d.name, 'Department', '/departments/' || d.id
     from public.departments d where d.church_id = p_church and lower(d.name) like q limit 5)
  union all
  (select 'service', s.id, s.name, to_char(s.service_date, 'Dy DD Mon YYYY'), '/services/' || s.id
     from public.services s where s.church_id = p_church and lower(s.name) like q
    order by s.service_date desc limit 5)
  union all
  (select 'event', e.id, e.name, to_char(e.start_date, 'DD Mon YYYY') || coalesce(' · ' || e.venue, ''), '/events/' || e.id
     from public.events e where e.church_id = p_church and lower(e.name) like q
    order by e.start_date desc limit 5);
end $$;
