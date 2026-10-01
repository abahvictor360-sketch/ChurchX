import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { inject } from "vitest";

export const dbUrl = inject("dbUrl");
export const hasDb = Boolean(dbUrl);

let pool: Pool | null = null;
export function getPool() {
  if (!pool) pool = new Pool({ connectionString: dbUrl, max: 4 });
  return pool;
}
export async function closePool() {
  await pool?.end();
  pool = null;
}

/** Runs SQL as the database owner (like a migration / service context). */
export async function asAdmin<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const res = await getPool().query(sql, params);
  return res.rows as T[];
}

/**
 * Runs fn inside a transaction impersonating a Supabase-authenticated user,
 * exactly as PostgREST does: SET ROLE authenticated + request.jwt.claims.
 * Changes are rolled back unless commit = true.
 */
export async function asUser<T>(
  userId: string | null,
  fn: (q: <R = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
  { commit = false }: { commit?: boolean } = {},
): Promise<T> {
  const client: PoolClient = await getPool().connect();
  try {
    await client.query("begin");
    const role = userId ? "authenticated" : "anon";
    const claims = userId ? { sub: userId, role } : { role };
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await client.query(`set local role ${role}`);
    const q = async <R,>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows as R[];
    const result = await fn(q);
    await client.query(commit ? "commit" : "rollback");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Expects the promise to reject with the given Postgres SQLSTATE (or any error). */
export async function expectPgError(promise: Promise<unknown>, code?: string) {
  try {
    await promise;
  } catch (error) {
    const pgCode = (error as { code?: string }).code;
    if (code && pgCode !== code) {
      throw new Error(`Expected SQLSTATE ${code} but got ${pgCode}: ${(error as Error).message}`);
    }
    return error as Error & { code?: string };
  }
  throw new Error(`Expected query to fail${code ? ` with ${code}` : ""}, but it succeeded`);
}

export async function createUser(email: string, fullName: string) {
  const id = randomUUID();
  await asAdmin(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    email,
    JSON.stringify({ full_name: fullName }),
  ]);
  return id;
}

export async function addChurchUser(churchId: string, userId: string, role: string, memberId?: string) {
  await asAdmin(
    `insert into public.church_users (church_id, user_id, role, status, member_id) values ($1, $2, $3, 'active', $4)`,
    [churchId, userId, role, memberId ?? null],
  );
}

export async function createChurch(ownerId: string, name: string) {
  return asUser(
    ownerId,
    async (q) => {
      const [row] = await q<{ id: string }>(`select public.create_church($1) as id`, [name]);
      return row.id;
    },
    { commit: true },
  );
}

export async function insertMember(churchId: string, data: Record<string, unknown> = {}) {
  const row = {
    first_name: "Test",
    last_name: "Member",
    membership_status: "active",
    join_date: "2025-01-01",
    ...data,
  };
  const cols = Object.keys(row);
  const [m] = await asAdmin<{ id: string }>(
    `insert into public.members (church_id, ${cols.join(", ")}) values ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")}) returning id`,
    [churchId, ...Object.values(row)],
  );
  return m.id;
}

export async function insertService(churchId: string, date: string, name = "Sunday Service") {
  const [s] = await asAdmin<{ id: string }>(
    `insert into public.services (church_id, name, service_date, status) values ($1, $2, $3, 'completed') returning id`,
    [churchId, name, date],
  );
  return s.id;
}
