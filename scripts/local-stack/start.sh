#!/usr/bin/env bash
# Docker-free local Supabase-compatible stack (Postgres + GoTrue + PostgREST).
# Prefer `supabase start` when Docker is available. Requires: a local
# PostgreSQL 15+ superuser connection (PGHOST/PGPORT/PGUSER), the GoTrue
# binary (GOTRUE_BIN) and PostgREST binary (POSTGREST_BIN).
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
DB="${DB_NAME:-churchx_local}"
JWT_SECRET="${JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters}"
export JWT_SECRET
PGHOST="${PGHOST:-localhost}"; PGPORT="${PGPORT:-5432}"; PGUSER="${PGUSER:-postgres}"
export PGHOST PGPORT PGUSER
LOGS="${LOGS:-/tmp/churchx-stack}"; mkdir -p "$LOGS"

if [[ "${RESET:-0}" == "1" ]]; then dropdb --if-exists --force "$DB"; fi
if ! psql -d "$DB" -c "select 1" >/dev/null 2>&1; then
  createdb "$DB"
  sed "s/current_database_placeholder/$DB/" roles.sql | psql -q -v ON_ERROR_STOP=1 -d "$DB"
  psql -q -d "$DB" -c "create extension if not exists pg_trgm with schema extensions"
  CONN="postgres://supabase_auth_admin:auth@${PGHOST}:${PGPORT}/${DB}?sslmode=disable"
  [[ "$PGHOST" == /* ]] && CONN="postgres://supabase_auth_admin:auth@localhost:${PGPORT}/${DB}?host=${PGHOST}&sslmode=disable"
  GOTRUE_DB_DRIVER=postgres DATABASE_URL="$CONN" GOTRUE_DB_NAMESPACE=auth API_EXTERNAL_URL=http://localhost:54321/auth/v1 \
    GOTRUE_SITE_URL=http://localhost:3000 GOTRUE_JWT_SECRET="$JWT_SECRET" "${GOTRUE_BIN:?set GOTRUE_BIN}" migrate >"$LOGS/migrate.log" 2>&1
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f post-auth.sql
  for f in "$ROOT"/supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
  echo "database $DB ready"
fi

eval "$(node keys.mjs)"
CONN="postgres://supabase_auth_admin:auth@${PGHOST}:${PGPORT}/${DB}?sslmode=disable"
[[ "$PGHOST" == /* ]] && CONN="postgres://supabase_auth_admin:auth@localhost:${PGPORT}/${DB}?host=${PGHOST}&sslmode=disable"
GOTRUE_DB_DRIVER=postgres DATABASE_URL="$CONN" GOTRUE_DB_NAMESPACE=auth GOTRUE_API_HOST=127.0.0.1 PORT=9999 \
  API_EXTERNAL_URL=http://localhost:54321/auth/v1 GOTRUE_SITE_URL=http://localhost:3000 \
  GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**" GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 \
  GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
  GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_DISABLE_SIGNUP=false \
  GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=2500 GOTRUE_SMTP_ADMIN_EMAIL=admin@churchx.local \
  "${GOTRUE_BIN}" serve >"$LOGS/gotrue.log" 2>&1 &
RCONN="postgres://authenticator:authenticator@${PGHOST}:${PGPORT}/${DB}"
[[ "$PGHOST" == /* ]] && RCONN="postgres://authenticator:authenticator@localhost:${PGPORT}/${DB}?host=${PGHOST}"
PGRST_DB_URI="$RCONN" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT=3001 \
  PGRST_DB_EXTRA_SEARCH_PATH=public,extensions "${POSTGREST_BIN:?set POSTGREST_BIN}" >"$LOGS/postgrest.log" 2>&1 &
node gateway.mjs >"$LOGS/gateway.log" 2>&1 &
sleep 2
cat <<ENV
# Add to .env.local:
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
SUPABASE_SECRET_KEY=$SERVICE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV
wait
