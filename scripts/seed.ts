/**
 * Development / demo seed. Creates one demo church with staff accounts for
 * every role, members, visitors, departments, services, attendance,
 * follow-ups, events and contributions.
 *
 *   CHURCHX_ALLOW_SEED=1 npm run db:seed
 *
 * Safety: refuses to run unless CHURCHX_ALLOW_SEED=1 is set, and refuses when
 * NODE_ENV/VERCEL_ENV is "production". It is never run automatically.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import type { Database } from "../types/database";

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

if (process.env.CHURCHX_ALLOW_SEED !== "1") {
  console.error("Refusing to seed: set CHURCHX_ALLOW_SEED=1 to confirm this is a development/demo database.");
  process.exit(1);
}
if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  console.error("Refusing to seed a production environment.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY.");
  process.exit(1);
}
const PASSWORD = process.env.SEED_PASSWORD ?? "ChurchX-demo-2026";
const DOMAIN = process.env.SEED_EMAIL_DOMAIN ?? "demo.churchx.app";

const admin = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

// Deterministic PRNG so the demo looks the same every time.
let seed = 20261001;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};
const phone = () => `+23480${Math.floor(10000000 + rand() * 89999999)}`;

const FIRST_M = ["Chinedu", "Emeka", "Tunde", "Segun", "Ibrahim", "Uche", "Femi", "Kelechi", "Yusuf", "Obinna", "Tobi", "David", "Samuel", "Daniel", "Joseph", "Peter"];
const FIRST_F = ["Ngozi", "Funke", "Aisha", "Blessing", "Chioma", "Yetunde", "Amaka", "Esther", "Grace", "Ruth", "Joy", "Favour", "Precious", "Kemi", "Halima", "Ifeoma"];
const LAST = ["Okafor", "Adeyemi", "Balogun", "Nwosu", "Okeke", "Adebayo", "Eze", "Ibrahim", "Olawale", "Chukwu", "Afolabi", "Bello", "Obi", "Ogunleye", "Uzor", "Danjuma", "Akpan", "Etim"];
const CITIES = [["Ikeja", "Lagos"], ["Lekki", "Lagos"], ["Surulere", "Lagos"], ["Wuse", "FCT"], ["Port Harcourt", "Rivers"], ["Enugu", "Enugu"]] as const;

async function ensureUser(email: string, fullName: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) {
    if (/already/i.test(error.message)) {
      const { data: p } = await admin.from("profiles").select("id").eq("email", email).single();
      if (p) return p.id;
    }
    throw error;
  }
  return data.user.id;
}

async function main() {
  console.log(`Seeding demo data into ${url}`);
  const staff = {
    admin: await ensureUser(`admin@${DOMAIN}`, "Pastor Femi Adeyemi (Admin)"),
    pastor: await ensureUser(`pastor@${DOMAIN}`, "Pastor Grace Okafor"),
    finance: await ensureUser(`finance@${DOMAIN}`, "Bisi Balogun (Finance)"),
    followup: await ensureUser(`followup@${DOMAIN}`, "Chioma Nwosu (Follow-up)"),
    attendance: await ensureUser(`attendance@${DOMAIN}`, "Tunde Bello (Usher)"),
    leader: await ensureUser(`leader@${DOMAIN}`, "Joy Etim (Choir Leader)"),
  };

  const { data: existing } = await admin.from("church_users").select("church_id").eq("user_id", staff.admin).limit(1);
  if (existing?.length) {
    console.log("Demo church already exists for the admin account — nothing to do.");
    return;
  }

  // Create the church through the real onboarding RPC, signed in as the admin.
  const asAdmin = createClient<Database>(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await asAdmin.auth.signInWithPassword({ email: `admin@${DOMAIN}`, password: PASSWORD });
  if (signInError) throw signInError;
  const { data: churchId, error: churchError } = await asAdmin.rpc("create_church", {
    p_name: "Grace Assembly (Demo)",
    p_country: "Nigeria",
    p_state: "Lagos",
    p_city: "Ikeja",
    p_address: "12 Allen Avenue, Ikeja",
    p_phone: "+2348012345678",
    p_email: `hello@${DOMAIN}`,
    p_timezone: "Africa/Lagos",
    p_currency: "NGN",
    p_service_days: [0, 3],
  });
  if (churchError || !churchId) throw churchError;
  await admin.from("churches").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", churchId);

  // Members
  const members: { id: string; first: string; status: string }[] = [];
  const memberRows = Array.from({ length: 64 }, (_, i) => {
    const male = chance(0.47);
    const first = male ? pick(FIRST_M) : pick(FIRST_F);
    const [city, state] = pick(CITIES);
    const join = daysAgo(Math.floor(10 + rand() * 1400));
    const status = i < 6 ? "new_member" : chance(0.12) ? "inactive" : "active";
    const birth = new Date(Date.UTC(1965 + Math.floor(rand() * 45), Math.floor(rand() * 12), 1 + Math.floor(rand() * 28)));
    return {
      church_id: churchId,
      first_name: first,
      last_name: pick(LAST),
      gender: male ? "male" : "female",
      phone: chance(0.92) ? phone() : null,
      email: chance(0.4) ? `${first.toLowerCase()}${i}@example.com` : null,
      city,
      state,
      country: "Nigeria",
      marital_status: pick(["single", "married", "married", "widowed"]),
      membership_status: status,
      join_date: i < 6 ? iso(daysAgo(5 + i * 4)) : iso(join),
      date_of_birth: iso(birth),
      occupation: pick(["Teacher", "Engineer", "Trader", "Nurse", "Banker", "Student", "Civil servant", "Entrepreneur"]),
    };
  });
  // Ensure birthdays today and this week for the care demo.
  const t = new Date();
  memberRows[7].date_of_birth = `1988-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  const soon = daysAgo(-3);
  memberRows[8].date_of_birth = `1992-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}`;
  const { data: insertedMembers, error: mErr } = await admin.from("members").insert(memberRows).select("id, first_name, membership_status");
  if (mErr) throw mErr;
  insertedMembers.forEach((m) => members.push({ id: m.id, first: m.first_name, status: m.membership_status }));

  // Staff accounts linked to roles (leader linked to a member record).
  const leaderMember = members[10];
  const { error: cuErr } = await admin.from("church_users").insert([
    { church_id: churchId, user_id: staff.pastor, role: "pastor", status: "active" },
    { church_id: churchId, user_id: staff.finance, role: "finance", status: "active" },
    { church_id: churchId, user_id: staff.followup, role: "followup_worker", status: "active" },
    { church_id: churchId, user_id: staff.attendance, role: "attendance_worker", status: "active" },
    { church_id: churchId, user_id: staff.leader, role: "department_leader", status: "active", member_id: leaderMember.id },
  ].map((r) => ({ member_id: null, ...r })));
  if (cuErr) throw cuErr;

  // Departments
  const deptNames = ["Choir", "Media", "Ushers", "Protocol", "Children", "Youth", "Follow-up", "Prayer"];
  const { data: depts, error: dErr } = await admin
    .from("departments")
    .insert(deptNames.map((name, i) => ({ church_id: churchId, name, description: `${name} department`, leader_member_id: i === 0 ? leaderMember.id : members[12 + i].id })))
    .select("id, name, leader_member_id");
  if (dErr) throw dErr;
  const dm: { church_id: string; department_id: string; member_id: string; joined_on: string }[] = [];
  depts.forEach((d) => {
    const set = new Set<string>([d.leader_member_id!]);
    members.slice(6).forEach((m) => chance(0.18) && set.add(m.id));
    set.forEach((id) => dm.push({ church_id: churchId, department_id: d.id, member_id: id, joined_on: iso(daysAgo(30 + Math.floor(rand() * 400))) }));
  });
  const { error: dmErr } = await admin.from("department_members").insert(dm);
  if (dmErr) throw dmErr;

  // Services for the last 12 weeks (Sundays + Wednesdays) and the next 2 weeks.
  const { data: types } = await admin.from("service_types").select("id, name").eq("church_id", churchId);
  const sunday = types!.find((x) => x.name === "Sunday Service")!.id;
  const midweek = types!.find((x) => x.name === "Midweek Service")!.id;
  const services: { church_id: string; service_type_id: string; name: string; service_date: string; start_time: string; end_time: string; status: string; location: string }[] = [];
  for (let back = 84; back >= -14; back--) {
    const d = daysAgo(back);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 3) continue;
    services.push({
      church_id: churchId,
      service_type_id: day === 0 ? sunday : midweek,
      name: day === 0 ? "Sunday Service" : "Midweek Service",
      service_date: iso(d),
      start_time: day === 0 ? "09:00" : "18:00",
      end_time: day === 0 ? "11:30" : "19:30",
      status: back > 0 ? "completed" : "scheduled",
      location: "Main Auditorium",
    });
  }
  const { data: svc, error: sErr } = await admin.from("services").insert(services).select("id, service_date, status, name");
  if (sErr) throw sErr;

  // Attendance: most active members attend regularly; a few drift away recently.
  const drifting = new Set(members.slice(20, 26).map((m) => m.id));
  const attendance: { church_id: string; service_id: string; member_id: string; status: string; recorded_by: string; method: string }[] = [];
  svc.filter((s) => s.status === "completed").forEach((s) => {
    const recent = new Date(s.service_date) > daysAgo(21);
    members.forEach((m) => {
      const base = m.status === "inactive" ? 0.15 : s.name === "Sunday Service" ? 0.8 : 0.45;
      const p = drifting.has(m.id) && recent ? 0.02 : base;
      if (chance(p)) attendance.push({ church_id: churchId, service_id: s.id, member_id: m.id, status: "present", recorded_by: staff.attendance, method: "manual" });
    });
  });
  for (let i = 0; i < attendance.length; i += 500) {
    const { error } = await admin.from("attendance").insert(attendance.slice(i, i + 500));
    if (error) throw error;
  }

  // Visitors
  const recentServices = svc.filter((s) => s.status === "completed" && s.name === "Sunday Service").slice(-6);
  const visitorRows = Array.from({ length: 18 }, (_, i) => {
    const male = chance(0.5);
    const s = recentServices[i % recentServices.length];
    return {
      church_id: churchId,
      first_name: male ? pick(FIRST_M) : pick(FIRST_F),
      last_name: pick(LAST),
      phone: phone(),
      gender: male ? "male" : "female",
      heard_about: pick(["Friend or family", "Social media", "Walked in", "Outreach / evangelism"]),
      service_id: s.id,
      visit_date: s.service_date,
      status: i < 6 ? "new" : pick(["contacted", "followup_ongoing", "interested", "not_interested"]),
      invited_by: chance(0.4) ? pick(members).first : null,
      created_by: staff.attendance,
    };
  });
  const { data: visitors, error: vErr } = await admin.from("visitors").insert(visitorRows).select("id, status, service_id");
  if (vErr) throw vErr;
  const { error: vaErr } = await admin.from("attendance").insert(visitors.map((v) => ({ church_id: churchId, service_id: v.service_id!, visitor_id: v.id, status: "present", recorded_by: staff.attendance })));
  if (vaErr) throw vaErr;

  // Follow-ups: some pending (today/overdue/upcoming), some completed.
  const fu = visitors.slice(0, 12).map((v, i) => ({
    church_id: churchId,
    visitor_id: v.id,
    assigned_to: staff.followup,
    assigned_by: staff.admin,
    due_date: iso(daysAgo(i % 4 === 0 ? 3 : i % 4 === 1 ? 0 : -2)),
    status: i >= 8 ? "completed" : "pending",
    contact_method: i >= 8 ? "whatsapp" : null,
    outcome: i >= 8 ? "reached" : null,
    notes: i >= 8 ? "Welcomed and invited to newcomers class." : "Welcome call after first visit",
    completed_at: i >= 8 ? new Date().toISOString() : null,
    completed_by: i >= 8 ? staff.followup : null,
  }));
  const { error: fuErr } = await admin.from("followups").insert(fu);
  if (fuErr) throw fuErr;

  // Contributions over 6 months.
  const { data: cats } = await admin.from("giving_categories").select("id, name").eq("church_id", churchId);
  const catId = (n: string) => cats!.find((c) => c.name === n)!.id;
  const gifts: Database["public"]["Tables"]["contributions"]["Insert"][] = [];
  svc.filter((s) => s.status === "completed" && s.name === "Sunday Service").forEach((s) => {
    members.forEach((m) => {
      if (chance(0.35)) gifts.push({ church_id: churchId, is_anonymous: false, reference: null, member_id: m.id, category_id: catId("Tithe"), amount: Math.round(5000 + rand() * 95000), currency: "NGN", contribution_date: s.service_date, payment_method: pick(["bank_transfer", "cash", "pos", "bank_transfer"]), recorded_by: staff.finance });
    });
    gifts.push({ church_id: churchId, is_anonymous: true, member_id: null, category_id: catId("Offering"), amount: Math.round(80000 + rand() * 250000), currency: "NGN", contribution_date: s.service_date, payment_method: "cash", reference: "Offering basket", recorded_by: staff.finance });
    if (chance(0.3)) gifts.push({ church_id: churchId, is_anonymous: false, reference: null, member_id: pick(members).id, category_id: catId("Project"), amount: Math.round(20000 + rand() * 200000), currency: "NGN", contribution_date: s.service_date, payment_method: "bank_transfer", recorded_by: staff.finance });
  });
  for (let i = 0; i < gifts.length; i += 500) {
    const { error } = await admin.from("contributions").insert(gifts.slice(i, i + 500));
    if (error) throw error;
  }

  // Events
  const { data: events, error: eErr } = await admin
    .from("events")
    .insert([
      { church_id: churchId, name: "Workers' Retreat", description: "Annual retreat for all workers.", start_date: iso(daysAgo(-1)), end_date: iso(daysAgo(-2)), start_time: "09:00", venue: "Camp Ground, Ibadan", capacity: 80, status: "scheduled", registration_status: "open" },
      { church_id: churchId, name: "Youth Conference", description: "Three days of worship and teaching for young people.", start_date: iso(daysAgo(-18)), end_date: iso(daysAgo(-20)), start_time: "10:00", venue: "Main Auditorium", capacity: 300, status: "scheduled", registration_status: "open" },
      { church_id: churchId, name: "Leadership Training", description: "Training for department leaders.", start_date: iso(daysAgo(30)), end_date: iso(daysAgo(30)), start_time: "10:00", venue: "Hall B", capacity: null, status: "completed", registration_status: "closed" },
    ])
    .select("id, name");
  if (eErr) throw eErr;
  const retreat = events!.find((e) => e.name === "Workers' Retreat")!;
  const { error: erErr } = await admin.from("event_registrations").insert(members.slice(6, 40).filter(() => chance(0.5)).map((m) => ({ church_id: churchId, event_id: retreat.id, member_id: m.id })));
  if (erErr) throw erErr;

  // Compute member-care alerts and notifications.
  const { error: careErr } = await admin.rpc("refresh_member_care", { p_church: churchId, p_force: true });
  if (careErr) throw careErr;

  console.log("\nDemo church ready: Grace Assembly (Demo)");
  console.log(`All accounts use the password: ${PASSWORD}`);
  for (const role of Object.keys(staff)) console.log(`  ${role.padEnd(10)} ${role}@${DOMAIN}`);
}

main().catch((e) => {
  console.error("Seed failed:", e?.message ?? e);
  process.exit(1);
});
