-- Roles/schemas that Supabase provides. Used only by the Docker-free local
-- stack (scripts/local-stack). NEVER run against a real Supabase project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit password 'authenticator'; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin login createrole password 'auth'; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
create schema if not exists auth authorization supabase_auth_admin;
create schema if not exists extensions;
grant usage on schema public, extensions to anon, authenticated, service_role;
grant create on database current_database_placeholder to supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth;
