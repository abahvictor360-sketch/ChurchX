import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    dbUrl: string;
  }
}

/**
 * Creates a throwaway database, loads the Supabase stub and applies every
 * migration in order. Requires TEST_DATABASE_URL pointing at a PostgreSQL 15+
 * server where the user may CREATE DATABASE (never a production database).
 */
export default async function setup(project: TestProject) {
  const adminUrl = process.env.TEST_DATABASE_URL;
  if (!adminUrl) {
    console.warn("[db tests] TEST_DATABASE_URL not set — database tests will be skipped.");
    project.provide("dbUrl", "");
    return;
  }
  const dbName = `churchx_test_${Date.now()}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  const root = path.resolve(__dirname, "../..");
  await client.query(readFileSync(path.join(root, "supabase/tests/supabase_stub.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await client.query(readFileSync(path.join(dir, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  await client.end();
  project.provide("dbUrl", url.toString());

  return async () => {
    const a = new Client({ connectionString: adminUrl });
    await a.connect();
    await a.query(`drop database if exists ${dbName} with (force)`);
    await a.end();
  };
}
