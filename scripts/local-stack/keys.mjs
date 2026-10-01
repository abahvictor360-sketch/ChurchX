// Prints HS256 anon/service keys for the local stack's JWT secret.
import { createHmac } from "node:crypto";
const secret = process.env.JWT_SECRET;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (payload) => {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
};
const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;
console.log(`ANON_KEY=${sign({ role: "anon", iss: "supabase-local", exp })}`);
console.log(`SERVICE_KEY=${sign({ role: "service_role", iss: "supabase-local", exp })}`);
