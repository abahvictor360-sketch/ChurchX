import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildWorld, type World } from "./fixtures";
import { asAdmin, asUser, closePool, expectPgError, hasDb, insertMember, insertService } from "./helpers";

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

describe.skipIf(!hasDb)("core workflows", () => {
  let w: World;
  beforeAll(async () => {
    w = await buildWorld();
  });
  afterAll(closePool);

  describe("onboarding", () => {
    it("create_church provisions settings, admin membership and defaults", async () => {
      const [settings] = await asAdmin<{ n: number }>(`select count(*)::int as n from public.church_settings where church_id = $1`, [w.churchA]);
      expect(settings.n).toBe(1);
      const types = await asAdmin(`select name from public.service_types where church_id = $1`, [w.churchA]);
      expect(types.length).toBeGreaterThanOrEqual(6);
      const cats = await asAdmin(`select name from public.giving_categories where church_id = $1`, [w.churchA]);
      expect(cats).toHaveLength(7);
      const perms = await asUser(w.adminA, (q) => q<{ p: string[] }>(`select public.my_permissions($1) as p`, [w.churchA]));
      expect(perms[0].p).toContain("users.manage");
    });

    it("rejects unauthenticated church creation and bad timezones", async () => {
      await asUser(w.adminA, async (q) => {
        await expectPgError(q(`select public.create_church('X Church', p_timezone => 'Mars/Olympus')`), "22023");
      });
    });
  });

  describe("members", () => {
    it("assigns sequential membership numbers per church", async () => {
      const id = await asUser(
        w.adminA,
        async (q) => {
          const [m] = await q<{ id: string; membership_number: string }>(
            `insert into public.members (church_id, first_name, last_name) values ($1, 'New', 'Person') returning id, membership_number`,
            [w.churchA],
          );
          expect(m.membership_number).toMatch(/^CX-\d{5}$/);
          return m.id;
        },
        { commit: true },
      );
      const [audit] = await asAdmin<{ action: string }>(`select action from public.audit_logs where entity_id = $1`, [id]);
      expect(audit.action).toBe("member.created");
    });

    it("validates phone and email formats", async () => {
      await asUser(w.adminA, async (q) => {
        await expectPgError(
          q(`insert into public.members (church_id, first_name, last_name, phone) values ($1, 'A', 'B', 'not-a-phone')`, [w.churchA]),
          "23514",
        );
      });
    });

    it("archiving sets archived_at", async () => {
      await asUser(w.adminA, async (q) => {
        const [m] = await q<{ archived_at: string | null }>(
          `update public.members set membership_status = 'archived' where id = $1 returning archived_at`,
          [w.otherMember],
        );
        expect(m.archived_at).not.toBeNull();
      });
    });
  });

  describe("visitor conversion", () => {
    it("converts without re-entering data and preserves follow-up history", async () => {
      await asUser(w.adminA, async (q) => {
        await q(`insert into public.followups (church_id, visitor_id, assigned_to) values ($1, $2, $3)`, [w.churchA, w.visitorA, w.adminA]);
        const [{ id: memberId }] = await q<{ id: string }>(
          `select public.convert_visitor_to_member($1, '{"city":"Abuja"}'::jsonb) as id`,
          [w.visitorA],
        );
        const [m] = await q<{ first_name: string; phone: string; city: string; membership_status: string }>(
          `select first_name, phone, city, membership_status from public.members where id = $1`,
          [memberId],
        );
        expect(m).toMatchObject({ first_name: "Victor", phone: "+2348044444444", city: "Abuja", membership_status: "new_member" });
        const [v] = await q<{ status: string; converted_member_id: string }>(
          `select status, converted_member_id from public.visitors where id = $1`,
          [w.visitorA],
        );
        expect(v).toEqual({ status: "converted", converted_member_id: memberId });
        const fus = await q(`select id from public.followups where member_id = $1 and visitor_id = $2`, [memberId, w.visitorA]);
        expect(fus).toHaveLength(1);
        await expectPgError(q(`select public.convert_visitor_to_member($1)`, [w.visitorA]), "P0001");
      });
    });

    it("attendance workers cannot convert visitors", async () => {
      await asUser(w.usher, async (q) => {
        await expectPgError(q(`select public.convert_visitor_to_member($1)`, [w.visitorA2]));
      });
    });
  });

  describe("attendance corrections", () => {
    it("authorised corrections update in place and are audited", async () => {
      await asUser(
        w.usher,
        (q) => q(`insert into public.attendance (church_id, service_id, member_id) values ($1, $2, $3)`, [w.churchA, w.serviceA, w.leaderMember]),
        { commit: true },
      );
      await asUser(
        w.adminA,
        async (q) => {
          const [a] = await q<{ status: string; corrected_by: string; recorded_by: string }>(
            `update public.attendance set status = 'excused' where service_id = $1 and member_id = $2 returning status, corrected_by, recorded_by`,
            [w.serviceA, w.leaderMember],
          );
          expect(a).toEqual({ status: "excused", corrected_by: w.adminA, recorded_by: w.usher });
        },
        { commit: true },
      );
      await asUser(w.adminA, async (q) => {
          await expectPgError(
            q(`update public.attendance set member_id = $3 where service_id = $1 and member_id = $2`, [w.serviceA, w.leaderMember, w.choirMember]),
            "42501",
          );
      });
      const logs = await asAdmin(`select 1 from public.audit_logs where church_id = $1 and action = 'attendance.corrected'`, [w.churchA]);
      expect(logs.length).toBeGreaterThan(0);
    });

    it("pastors (no correction permission) cannot change attendance", async () => {
      await asUser(w.pastor, async (q) => {
        expect(await q(`update public.attendance set status = 'absent' returning id`)).toHaveLength(0);
      });
    });
  });

  describe("follow-up assignment", () => {
    it("admins assign follow-ups and the worker is notified", async () => {
      await asUser(
        w.adminA,
        async (q) => {
          const [r] = await q<{ n: number }>(`select public.assign_followups($1, $2, array[$3]::uuid[], array[$4]::uuid[]) as n`, [
            w.churchA,
            w.worker,
            w.choirMember,
            w.visitorA2,
          ]);
          expect(r.n).toBe(2);
        },
        { commit: true },
      );
      const notes = await asUser(w.worker, (q) => q<{ type: string }>(`select type from public.notifications`));
      expect(notes.filter((n) => n.type === "followup_assigned")).toHaveLength(2);
      const members = await asUser(w.worker, (q) => q<{ first_name: string }>(`select first_name from public.members`));
      expect(members.map((m) => m.first_name)).toEqual(["Chidi"]);
    });
  });

  describe("events", () => {
    it("enforces capacity and closed registration", async () => {
      await asUser(w.adminA, async (q) => {
        const [e] = await q<{ id: string }>(
          `insert into public.events (church_id, name, start_date, end_date, capacity) values ($1, 'Retreat', current_date, current_date, 1) returning id`,
          [w.churchA],
        );
        await q(`insert into public.event_registrations (church_id, event_id, member_id) values ($1, $2, $3)`, [w.churchA, e.id, w.choirMember]);
        await expectPgError(
          q(`insert into public.event_registrations (church_id, event_id, guest_name) values ($1, $2, 'Walk In')`, [w.churchA, e.id]),
          "P0001",
        );
      });
    });
  });

  describe("member care rules", () => {
    it("flags absences, birthdays, new members without department, and overdue follow-ups", async () => {
      const church = w.churchA;
      // 5 past services; Absent Ada attended only the first; Steady Sam attended all.
      const services: string[] = [];
      for (const d of [35, 28, 21, 14, 7]) services.push(await insertService(church, daysAgo(d)));
      const ada = await insertMember(church, { first_name: "Absent", last_name: "Ada", join_date: daysAgo(100) });
      const sam = await insertMember(church, { first_name: "Steady", last_name: "Sam", join_date: daysAgo(100) });
      const ben = await insertMember(church, { first_name: "Two", last_name: "Missed", join_date: daysAgo(100) });
      await asAdmin(`insert into public.attendance (church_id, service_id, member_id) values ($1, $2, $3)`, [church, services[0], ada]);
      for (const s of services) {
        await asAdmin(`insert into public.attendance (church_id, service_id, member_id) values ($1, $2, $3)`, [church, s, sam]);
      }
      for (const s of services.slice(0, 3)) {
        await asAdmin(`insert into public.attendance (church_id, service_id, member_id) values ($1, $2, $3)`, [church, s, ben]);
      }
      // Today's fixture service also exists (w.serviceA) — attend it for all to isolate counts
      for (const m of [ada, sam, ben]) {
        await asAdmin(`insert into public.attendance (church_id, service_id, member_id, status) values ($1, $2, $3, 'absent')`, [church, w.serviceA, m]);
      }
      const today = new Date();
      const bday = await insertMember(church, {
        first_name: "Birthday",
        last_name: "Bola",
        date_of_birth: `1990-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`,
      });
      const newbie = await insertMember(church, { first_name: "New", last_name: "Nobody", membership_status: "new_member", join_date: daysAgo(20) });
      await asAdmin(`insert into public.followups (church_id, member_id, assigned_to, due_date) values ($1, $2, $3, current_date - 3)`, [
        church,
        sam,
        w.worker,
      ]);
      await asAdmin(`update public.churches set timezone = 'UTC' where id = $1`, [church]);

      const [res] = await asUser(w.pastor, (q) => q<{ r: { open_alerts: number } }>(`select public.refresh_member_care($1, true) as r`, [church]), {
        commit: true,
      });
      expect(res.r.open_alerts).toBeGreaterThan(0);

      const alerts = await asUser(w.pastor, (q) =>
        q<{ alert_type: string; member_id: string; visitor_id: string }>(
          `select alert_type, member_id, visitor_id from public.member_care_alerts where status = 'open'`,
        ),
      );
      const has = (type: string, id: string) => alerts.some((a) => a.alert_type === type && (a.member_id === id || a.visitor_id === id));
      expect(has("absent_long", ada)).toBe(true); // missed 5
      expect(has("absent_consecutive", ben)).toBe(true); // missed 3 (>= 2, < 4)
      expect(alerts.some((a) => a.member_id === sam && a.alert_type.startsWith("absent"))).toBe(false);
      expect(has("birthday_today", bday)).toBe(true);
      expect(has("no_department", newbie)).toBe(true);
      expect(has("followup_overdue", sam)).toBe(true);
      expect(has("visitor_not_contacted", w.visitorA)).toBe(true); // visited 5 days ago, still "new"

      // Pastor gets birthday + digest notifications; the worker gets an overdue notice.
      const pastorNotes = await asUser(w.pastor, (q) => q<{ type: string }>(`select type from public.notifications`));
      expect(pastorNotes.map((n) => n.type)).toEqual(expect.arrayContaining(["birthday", "care_alert"]));
      const workerNotes = await asUser(w.worker, (q) => q<{ type: string }>(`select type from public.notifications`));
      expect(workerNotes.map((n) => n.type)).toContain("followup_overdue");

      // Ben attends today → his absence alert auto-resolves on refresh.
      await asAdmin(`update public.attendance set status = 'present' where service_id = $1 and member_id = $2`, [w.serviceA, ben]);
      await asUser(w.pastor, (q) => q(`select public.refresh_member_care($1, true)`, [church]), { commit: true });
      const [benAlert] = await asAdmin<{ status: string }>(
        `select status from public.member_care_alerts where member_id = $1 and alert_type = 'absent_consecutive'`,
        [ben],
      );
      expect(benAlert.status).toBe("auto_resolved");

      // Resolving manually requires care.manage (pastor has it, usher does not).
      await asUser(w.usher, async (q) => {
        expect(await q(`update public.member_care_alerts set status = 'resolved' returning id`)).toHaveLength(0);
      });
      await asUser(w.pastor, async (q) => {
        const [a] = await q<{ resolved_by: string }>(
          `update public.member_care_alerts set status = 'resolved' where member_id = $1 and alert_type = 'absent_long' returning resolved_by`,
          [ada],
        );
        expect(a.resolved_by).toBe(w.pastor);
      });
    });

    it("refresh is throttled unless forced", async () => {
      const [r] = await asUser(w.adminA, (q) => q<{ r: { skipped: boolean } }>(`select public.refresh_member_care($1) as r`, [w.churchA]));
      expect(r.r.skipped).toBe(true);
    });
  });

  describe("reports", () => {
    it("aggregates attendance and giving from real data", async () => {
      const att = await asUser(w.adminA, (q) =>
        q<{ present: string }>(`select * from public.report_attendance($1, current_date - 60, current_date, 'month')`, [w.churchA]),
      );
      expect(att.reduce((s, r) => s + Number(r.present), 0)).toBeGreaterThan(0);
      const [g] = await asUser(w.finance, (q) => q<{ s: { month: string; currency: string } }>(`select public.report_giving_summary($1) as s`, [w.churchA]));
      expect(g.s.currency).toBe("NGN");
      expect(Number(g.s.month)).toBe(2500);
    });
  });
});
