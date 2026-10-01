import { randomUUID } from "node:crypto";
import { addChurchUser, asAdmin, createChurch, createUser, insertMember, insertService } from "./helpers";

export type World = Awaited<ReturnType<typeof buildWorld>>;

/**
 * Two churches with a full set of staff in Church A and an admin in Church B.
 * User A (adminA) belongs to Church A; User B (adminB) belongs to Church B.
 */
export async function buildWorld() {
  const tag = randomUUID().slice(0, 8);
  const adminA = await createUser(`admin-a-${tag}@test.local`, "Admin A");
  const adminB = await createUser(`admin-b-${tag}@test.local`, "Admin B");
  const churchA = await createChurch(adminA, `Grace Church ${tag}`);
  const churchB = await createChurch(adminB, `Hope Church ${tag}`);

  const leaderMember = await insertMember(churchA, { first_name: "Lydia", last_name: "Leader", phone: "+2348011111111" });
  const choirMember = await insertMember(churchA, { first_name: "Chidi", last_name: "Choir", phone: "+2348022222222" });
  const otherMember = await insertMember(churchA, { first_name: "Ola", last_name: "Other", phone: "+2348033333333" });
  const memberB = await insertMember(churchB, { first_name: "Bisi", last_name: "Bravo", phone: "+2348099999999" });

  const pastor = await createUser(`pastor-${tag}@test.local`, "Pastor P");
  const finance = await createUser(`finance-${tag}@test.local`, "Finance F");
  const leader = await createUser(`leader-${tag}@test.local`, "Leader L");
  const worker = await createUser(`worker-${tag}@test.local`, "Followup W");
  const usher = await createUser(`usher-${tag}@test.local`, "Attendance U");
  await addChurchUser(churchA, pastor, "pastor");
  await addChurchUser(churchA, finance, "finance");
  await addChurchUser(churchA, leader, "department_leader", leaderMember);
  await addChurchUser(churchA, worker, "followup_worker");
  await addChurchUser(churchA, usher, "attendance_worker");

  const [choir] = await asAdmin<{ id: string }>(
    `insert into public.departments (church_id, name, leader_member_id) values ($1, 'Choir', $2) returning id`,
    [churchA, leaderMember],
  );
  const [media] = await asAdmin<{ id: string }>(
    `insert into public.departments (church_id, name) values ($1, 'Media') returning id`,
    [churchA],
  );
  await asAdmin(
    `insert into public.department_members (church_id, department_id, member_id) values ($1, $2, $3), ($1, $4, $5)`,
    [churchA, choir.id, choirMember, media.id, otherMember],
  );

  const [visitorA] = await asAdmin<{ id: string }>(
    `insert into public.visitors (church_id, first_name, last_name, phone, visit_date) values ($1, 'Victor', 'Visitor', '+2348044444444', current_date - 5) returning id`,
    [churchA],
  );
  const [visitorA2] = await asAdmin<{ id: string }>(
    `insert into public.visitors (church_id, first_name, last_name, visit_date) values ($1, 'Unassigned', 'Guest', current_date) returning id`,
    [churchA],
  );
  const [visitorB] = await asAdmin<{ id: string }>(
    `insert into public.visitors (church_id, first_name, last_name) values ($1, 'Bola', 'Guest') returning id`,
    [churchB],
  );

  const serviceA = await insertService(churchA, new Date().toISOString().slice(0, 10));
  const serviceB = await insertService(churchB, new Date().toISOString().slice(0, 10));

  const [catA] = await asAdmin<{ id: string }>(
    `select id from public.giving_categories where church_id = $1 and name = 'Tithe'`,
    [churchA],
  );
  const [catB] = await asAdmin<{ id: string }>(
    `select id from public.giving_categories where church_id = $1 and name = 'Tithe'`,
    [churchB],
  );
  await asAdmin(
    `insert into public.contributions (church_id, member_id, category_id, amount, currency, payment_method) values ($1, $2, $3, 5000, 'NGN', 'cash')`,
    [churchB, memberB, catB.id],
  );
  await asAdmin(
    `insert into public.contributions (church_id, member_id, category_id, amount, currency, payment_method) values ($1, $2, $3, 2500, 'NGN', 'cash')`,
    [churchA, choirMember, catA.id],
  );
  await asAdmin(
    `insert into public.member_notes (church_id, member_id, visibility, body) values ($1, $2, 'confidential', 'Private pastoral matter'), ($1, $2, 'general', 'Loves singing')`,
    [churchA, choirMember],
  );

  return {
    tag,
    churchA,
    churchB,
    adminA,
    adminB,
    pastor,
    finance,
    leader,
    worker,
    usher,
    leaderMember,
    choirMember,
    otherMember,
    memberB,
    choirDept: choir.id,
    mediaDept: media.id,
    visitorA: visitorA.id,
    visitorA2: visitorA2.id,
    visitorB: visitorB.id,
    serviceA,
    serviceB,
    categoryA: catA.id,
    categoryB: catB.id,
  };
}
