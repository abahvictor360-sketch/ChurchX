-- ChurchX: privileges (least privilege; RLS still applies on top) and storage

-- ---------------------------------------------------------------------------
-- Table privileges. anon gets nothing. authenticated gets no DELETE anywhere:
-- history is archived/voided, never deleted from the app.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.roles, public.permissions, public.role_permissions to authenticated;
grant select on public.audit_logs to authenticated;

grant select, insert, update on
  public.members, public.member_notes, public.visitors, public.departments, public.department_members,
  public.followups, public.service_types, public.services, public.attendance, public.events,
  public.event_registrations, public.giving_categories, public.contributions
to authenticated;

-- Column-restricted tables
grant select on public.churches to authenticated;
grant update (name, logo_path, country, state, city, address, phone, email, website, timezone, currency,
              onboarding_completed_at) on public.churches to authenticated;

grant select on public.church_settings to authenticated;
grant update (default_service_days, member_number_prefix, care_rules) on public.church_settings to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_path) on public.profiles to authenticated;

grant select on public.church_users to authenticated;
grant insert (church_id, user_id, role, status, member_id, invited_email, invited_by, invited_at)
  on public.church_users to authenticated;
grant update (role, status, member_id) on public.church_users to authenticated;

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant select on public.member_care_alerts to authenticated;
grant update (status, assigned_to, resolution_note) on public.member_care_alerts to authenticated;

-- service_role (server-side only) keeps full access for invitations & seeding.
grant all on all tables in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage: church-assets (public logos) and member-photos (private).
-- Object paths must start with "<church_id>/".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('church-assets', 'church-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('member-photos', 'member-photos', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "church assets readable" on storage.objects for select to authenticated
  using (bucket_id = 'church-assets');
create policy "church assets writable by church managers" on storage.objects for insert to authenticated
  with check (bucket_id = 'church-assets'
              and (storage.foldername(name))[1] in (select c::text from private.churches_with('church.manage') c));
create policy "church assets updatable by church managers" on storage.objects for update to authenticated
  using (bucket_id = 'church-assets'
         and (storage.foldername(name))[1] in (select c::text from private.churches_with('church.manage') c));
create policy "church assets deletable by church managers" on storage.objects for delete to authenticated
  using (bucket_id = 'church-assets'
         and (storage.foldername(name))[1] in (select c::text from private.churches_with('church.manage') c));

create policy "member photos readable" on storage.objects for select to authenticated
  using (bucket_id = 'member-photos'
         and (storage.foldername(name))[1] in (select c::text from private.churches_with('members.view') c));
create policy "member photos writable" on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos'
              and (storage.foldername(name))[1] in (select c::text from private.churches_with('members.manage') c));
create policy "member photos updatable" on storage.objects for update to authenticated
  using (bucket_id = 'member-photos'
         and (storage.foldername(name))[1] in (select c::text from private.churches_with('members.manage') c));
create policy "member photos deletable" on storage.objects for delete to authenticated
  using (bucket_id = 'member-photos'
         and (storage.foldername(name))[1] in (select c::text from private.churches_with('members.manage') c));
