-- ChurchX: giving, notifications, member care alerts, audit log

-- ---------------------------------------------------------------------------
-- Giving
-- ---------------------------------------------------------------------------
create table public.giving_categories (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 60),
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, id)
);
create unique index giving_categories_church_name_uq on public.giving_categories (church_id, lower(name));
create trigger giving_categories_updated_at before update on public.giving_categories
  for each row execute function private.set_updated_at();
create trigger giving_categories_church_lock before update on public.giving_categories
  for each row execute function private.prevent_church_change();

-- source/external_id prepare for Paystack / Flutterwave / Stripe webhooks.
create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  member_id uuid,
  is_anonymous boolean not null default false,
  contributor_name text check (contributor_name is null or char_length(contributor_name) <= 160),
  category_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0 and amount < 1000000000000),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  contribution_date date not null default current_date,
  payment_method text not null check (payment_method in ('cash', 'bank_transfer', 'card', 'pos', 'online', 'other')),
  reference text check (reference is null or char_length(reference) <= 120),
  notes text check (notes is null or char_length(notes) <= 1000),
  status text not null default 'recorded' check (status in ('recorded', 'voided')),
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'import', 'paystack', 'flutterwave', 'stripe')),
  external_id text,
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (church_id, member_id) references public.members (church_id, id) on delete set null (member_id),
  foreign key (church_id, category_id) references public.giving_categories (church_id, id),
  check (not (is_anonymous and member_id is not null)),
  check (status <> 'voided' or (void_reason is not null and voided_at is not null))
);
create unique index contributions_external_uq on public.contributions (source, external_id) where external_id is not null;
create index contributions_church_date_idx on public.contributions (church_id, contribution_date desc) where status = 'recorded';
create index contributions_member_idx on public.contributions (church_id, member_id) where member_id is not null;
create index contributions_category_idx on public.contributions (church_id, category_id, contribution_date);
create trigger contributions_updated_at before update on public.contributions
  for each row execute function private.set_updated_at();
create trigger contributions_church_lock before update on public.contributions
  for each row execute function private.prevent_church_change();
create trigger contributions_recorded_by before insert on public.contributions
  for each row execute function private.set_actor_column('recorded_by');

create or replace function private.contribution_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    -- Currency always comes from church settings.
    select c.currency into new.currency from public.churches c where c.id = new.church_id;
  else
    new.recorded_by := old.recorded_by;
    new.currency := old.currency;
    if old.status = 'voided' and new.status = 'recorded' then
      raise exception 'A voided contribution cannot be restored; record a new one' using errcode = 'P0001';
    end if;
    if new.status = 'voided' and old.status = 'recorded' then
      new.voided_at := now();
      new.voided_by := coalesce(auth.uid(), new.voided_by);
    end if;
  end if;
  if new.is_anonymous then
    new.member_id := null;
    new.contributor_name := null;
  end if;
  return new;
end $$;
create trigger contributions_defaults before insert or update on public.contributions
  for each row execute function private.contribution_defaults();

-- ---------------------------------------------------------------------------
-- Notifications (in-app). channel/delivery_status prepare for email/SMS/
-- WhatsApp/push; no external delivery happens in the MVP.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('followup_due', 'followup_overdue', 'followup_assigned', 'birthday',
                                     'event_upcoming', 'care_alert', 'system')),
  title text not null,
  body text,
  link text check (link is null or link ~ '^/'),
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'sms', 'whatsapp', 'push')),
  delivery_status text not null default 'delivered' check (delivery_status in ('pending', 'delivered', 'failed', 'skipped')),
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, church_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id, church_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Member care alerts (computed by refresh_member_care)
-- ---------------------------------------------------------------------------
create table public.member_care_alerts (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  alert_type text not null check (alert_type in ('absent_consecutive', 'absent_long', 'visitor_not_contacted',
                                                 'followup_overdue', 'birthday_today', 'birthday_week',
                                                 'no_department', 'attendance_drop')),
  member_id uuid,
  visitor_id uuid,
  followup_id uuid,
  period_key text not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'resolved', 'auto_resolved')),
  assigned_to uuid,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (church_id, member_id) references public.members (church_id, id) on delete cascade,
  foreign key (church_id, visitor_id) references public.visitors (church_id, id) on delete cascade,
  foreign key (church_id, followup_id) references public.followups (church_id, id) on delete cascade,
  foreign key (church_id, assigned_to) references public.church_users (church_id, user_id),
  check (num_nonnulls(member_id, visitor_id) = 1)
);
create unique index member_care_alerts_dedupe_uq on public.member_care_alerts
  (church_id, alert_type, coalesce(member_id, visitor_id), period_key);
create index member_care_alerts_open_idx on public.member_care_alerts (church_id, status, alert_type);
create trigger member_care_alerts_updated_at before update on public.member_care_alerts
  for each row execute function private.set_updated_at();
create trigger member_care_alerts_church_lock before update on public.member_care_alerts
  for each row execute function private.prevent_church_change();

create or replace function private.care_alert_resolution()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'resolved' and old.status <> 'resolved' then
    new.resolved_at := now();
    new.resolved_by := coalesce(auth.uid(), new.resolved_by);
  elsif new.status = 'open' then
    new.resolved_at := null;
    new.resolved_by := null;
  end if;
  -- these are computed fields
  new.alert_type := old.alert_type;
  new.member_id := old.member_id;
  new.visitor_id := old.visitor_id;
  new.period_key := old.period_key;
  return new;
end $$;
create trigger member_care_alerts_resolution before update on public.member_care_alerts
  for each row execute function private.care_alert_resolution();

alter table public.followups
  add constraint followups_care_alert_fk foreign key (care_alert_id)
  references public.member_care_alerts (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Audit log (append-only; written only by SECURITY DEFINER triggers)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references public.churches (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_church_idx on public.audit_logs (church_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (church_id, entity_type, entity_id);

-- Records which fields changed — not their values — so personal data does not
-- leak into the log. Selected non-personal fields are captured explicitly.
create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  entity text := tg_argv[0];
  v_action text;
  v_church uuid;
  v_id uuid;
  meta jsonb := '{}'::jsonb;
  changed text[];
  old_j jsonb;
  new_j jsonb;
begin
  new_j := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  old_j := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_id := coalesce(new_j, old_j) ->> 'id';
  v_church := coalesce((coalesce(new_j, old_j) ->> 'church_id')::uuid, case when entity = 'church' then v_id end);

  if tg_op = 'INSERT' then
    v_action := entity || '.created';
  elsif tg_op = 'DELETE' then
    v_action := entity || '.deleted';
  else
    select array_agg(k order by k) into changed
    from jsonb_object_keys(new_j) k
    where k not in ('updated_at', 'search_text', 'full_name', 'member_seq', 'care_refreshed_at')
      and new_j -> k is distinct from old_j -> k;
    if changed is null then
      return null; -- nothing meaningful changed
    end if;
    v_action := entity || '.updated';
    meta := jsonb_build_object('changed', to_jsonb(changed));
  end if;

  -- Entity specific, non-sensitive context
  if entity = 'member' then
    meta := meta || jsonb_build_object('name', coalesce(new_j, old_j) ->> 'full_name',
                                       'membership_number', coalesce(new_j, old_j) ->> 'membership_number');
    if tg_op = 'UPDATE' and new_j ->> 'membership_status' = 'archived' and old_j ->> 'membership_status' <> 'archived' then
      v_action := 'member.archived';
    elsif tg_op = 'UPDATE' and old_j ->> 'membership_status' is distinct from new_j ->> 'membership_status' then
      meta := meta || jsonb_build_object('status_from', old_j ->> 'membership_status', 'status_to', new_j ->> 'membership_status');
    end if;
  elsif entity = 'contribution' then
    meta := meta || jsonb_build_object('amount', new_j ->> 'amount', 'currency', new_j ->> 'currency',
                                       'status', new_j ->> 'status');
    if tg_op = 'UPDATE' then
      meta := meta || jsonb_build_object('amount_before', old_j ->> 'amount');
      if new_j ->> 'status' = 'voided' and old_j ->> 'status' <> 'voided' then
        v_action := 'contribution.voided';
      end if;
    end if;
  elsif entity = 'church_user' then
    meta := meta || jsonb_build_object('user_id', new_j ->> 'user_id', 'role', new_j ->> 'role', 'status', new_j ->> 'status');
    if tg_op = 'INSERT' and new_j ->> 'status' = 'invited' then
      v_action := 'user.invited';
      meta := meta || jsonb_build_object('email', new_j ->> 'invited_email');
    elsif tg_op = 'UPDATE' and old_j ->> 'role' is distinct from new_j ->> 'role' then
      v_action := 'user.role_changed';
      meta := meta || jsonb_build_object('role_from', old_j ->> 'role');
    elsif tg_op = 'UPDATE' and old_j ->> 'status' is distinct from new_j ->> 'status' then
      v_action := 'user.status_changed';
      meta := meta || jsonb_build_object('status_from', old_j ->> 'status');
    end if;
  elsif entity = 'visitor' then
    if tg_op = 'UPDATE' and new_j ->> 'status' = 'converted' and old_j ->> 'status' <> 'converted' then
      v_action := 'visitor.converted';
      meta := meta || jsonb_build_object('member_id', new_j ->> 'converted_member_id');
    end if;
  elsif entity = 'attendance' and tg_op = 'UPDATE' then
    v_action := 'attendance.corrected';
    meta := meta || jsonb_build_object('status_from', old_j ->> 'status', 'status_to', new_j ->> 'status',
                                       'service_id', new_j ->> 'service_id');
  elsif entity in ('church', 'church_settings', 'giving_category', 'department', 'service_type') then
    if new_j ? 'name' then
      meta := meta || jsonb_build_object('name', new_j ->> 'name');
    end if;
  end if;

  insert into public.audit_logs (church_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_church, auth.uid(), v_action, entity,
          case when entity = 'church_settings' then v_church else v_id end, meta);
  return null;
end $$;

create trigger audit_members after insert or update on public.members
  for each row execute function private.audit_row('member');
create trigger audit_visitors after update on public.visitors
  for each row execute function private.audit_row('visitor');
create trigger audit_contributions after insert or update on public.contributions
  for each row execute function private.audit_row('contribution');
create trigger audit_church_users after insert or update on public.church_users
  for each row execute function private.audit_row('church_user');
create trigger audit_churches after update on public.churches
  for each row execute function private.audit_row('church');
create trigger audit_church_settings after update on public.church_settings
  for each row execute function private.audit_row('church_settings');
create trigger audit_giving_categories after insert or update on public.giving_categories
  for each row execute function private.audit_row('giving_category');
create trigger audit_departments after insert or update on public.departments
  for each row execute function private.audit_row('department');
create trigger audit_service_types after insert or update on public.service_types
  for each row execute function private.audit_row('service_type');
create trigger audit_attendance after update on public.attendance
  for each row execute function private.audit_row('attendance');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.giving_categories enable row level security;
alter table public.contributions enable row level security;
alter table public.notifications enable row level security;
alter table public.member_care_alerts enable row level security;
alter table public.audit_logs enable row level security;

create policy giving_categories_select on public.giving_categories for select to authenticated using (
  church_id in (select private.churches_with('giving.view'))
  or church_id in (select private.churches_with('giving.manage'))
);
create policy giving_categories_insert on public.giving_categories for insert to authenticated
  with check (church_id in (select private.churches_with('church.manage')));
create policy giving_categories_update on public.giving_categories for update to authenticated
  using (church_id in (select private.churches_with('church.manage')))
  with check (church_id in (select private.churches_with('church.manage')));

create policy contributions_select on public.contributions for select to authenticated
  using (church_id in (select private.churches_with('giving.view')));
create policy contributions_insert on public.contributions for insert to authenticated
  with check (church_id in (select private.churches_with('giving.manage')) and status = 'recorded');
create policy contributions_update on public.contributions for update to authenticated
  using (church_id in (select private.churches_with('giving.manage')))
  with check (church_id in (select private.churches_with('giving.manage')));

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy member_care_alerts_select on public.member_care_alerts for select to authenticated
  using (church_id in (select private.churches_with('care.view')));
create policy member_care_alerts_update on public.member_care_alerts for update to authenticated
  using (church_id in (select private.churches_with('care.manage')))
  with check (church_id in (select private.churches_with('care.manage')));

create policy audit_logs_select on public.audit_logs for select to authenticated
  using (church_id in (select private.churches_with('audit.view')));
