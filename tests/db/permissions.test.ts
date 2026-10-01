import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildWorld, type World } from "./fixtures";
import { asAdmin, asUser, closePool, expectPgError, hasDb } from "./helpers";

describe.skipIf(!hasDb)("role permissions", () => {
  let w: World;
  beforeAll(async () => {
    w = await buildWorld();
    // follow-up worker is assigned only to visitorA
    await asAdmin(`insert into public.followups (church_id, visitor_id, assigned_to, due_date) values ($1, $2, $3, current_date)`, [
      w.churchA,
      w.visitorA,
      w.worker,
    ]);
  });
  afterAll(closePool);

  describe("attendance worker", () => {
    it("cannot read the member directory (contact details)", async () => {
      const rows = await asUser(w.usher, (q) => q(`select phone from public.members`));
      expect(rows).toHaveLength(0);
    });

    it("can search people for check-in without contact details", async () => {
      const rows = await asUser(w.usher, (q) => q<Record<string, unknown>>(`select * from public.checkin_search($1, 'chidi')`, [w.serviceA]));
      expect(rows).toHaveLength(1);
      expect(rows[0].full_name).toBe("Chidi Choir");
      expect(Object.keys(rows[0])).not.toContain("phone");
    });

    it("can check people in and duplicates are rejected", async () => {
      await asUser(w.usher, async (q) => {
        await q(`insert into public.attendance (church_id, service_id, member_id) values ($1, $2, $3)`, [w.churchA, w.serviceA, w.choirMember]);
        await expectPgError(
          q(`insert into public.attendance (church_id, service_id, member_id) values ($1, $2, $3)`, [w.churchA, w.serviceA, w.choirMember]),
          "23505",
        );
      });
    });

    it("bulk check-in skips people already checked in", async () => {
      await asUser(w.usher, async (q) => {
        await q(`insert into public.attendance (church_id, service_id, member_id) values ($1, $2, $3)`, [w.churchA, w.serviceA, w.choirMember]);
        const [r] = await q<{ n: number }>(`select public.bulk_mark_attendance($1, array[$2, $3]::uuid[]) as n`, [
          w.serviceA,
          w.choirMember,
          w.otherMember,
        ]);
        expect(r.n).toBe(1);
      });
    });

    it("records attendance as themselves (recorded_by cannot be spoofed)", async () => {
      await asUser(w.usher, async (q) => {
        const [row] = await q<{ recorded_by: string }>(
          `insert into public.attendance (church_id, service_id, member_id, recorded_by) values ($1, $2, $3, $4) returning recorded_by`,
          [w.churchA, w.serviceA, w.otherMember, w.adminA],
        );
        expect(row.recorded_by).toBe(w.usher);
      });
    });

    it("cannot see contributions, confidential notes or reports", async () => {
      await asUser(w.usher, async (q) => {
        expect(await q(`select * from public.contributions`)).toHaveLength(0);
        expect(await q(`select * from public.member_notes`)).toHaveLength(0);
      });
      await asUser(w.usher, async (q) => {
        await expectPgError(q(`select public.report_giving_summary($1)`, [w.churchA]), "42501");
      });
      await asUser(w.usher, async (q) => {
        await expectPgError(q(`select * from public.report_attendance($1, current_date - 7, current_date)`, [w.churchA]), "42501");
      });
    });

    it("dashboard omits sections it may not see", async () => {
      const [row] = await asUser(w.usher, (q) => q<{ s: Record<string, unknown> }>(`select public.dashboard_summary($1) as s`, [w.churchA]));
      expect(row.s).not.toHaveProperty("total_members");
      expect(row.s).not.toHaveProperty("giving_month");
      expect(row.s).toHaveProperty("upcoming_services");
    });
  });

  describe("finance", () => {
    it("can view and record contributions", async () => {
      await asUser(w.finance, async (q) => {
        expect(await q(`select * from public.contributions`)).toHaveLength(1);
        const [c] = await q<{ currency: string; recorded_by: string }>(
          `insert into public.contributions (church_id, category_id, amount, currency, payment_method, is_anonymous)
           values ($1, $2, 1000, 'USD', 'pos', true) returning currency, recorded_by`,
          [w.churchA, w.categoryA],
        );
        expect(c.currency).toBe("NGN"); // always the church currency
        expect(c.recorded_by).toBe(w.finance);
      });
    });

    it("cannot browse the member directory", async () => {
      expect(await asUser(w.finance, (q) => q(`select * from public.members`))).toHaveLength(0);
    });

    it("can pick contributors through the contact-free lookup", async () => {
      const rows = await asUser(w.finance, (q) => q<Record<string, unknown>>(`select * from public.lookup_people($1, 'chi', 'member')`, [w.churchA]));
      expect(rows.map((r) => r.full_name)).toEqual(["Chidi Choir"]);
      expect(Object.keys(rows[0])).not.toContain("phone");
    });

    it("cannot delete contributions; voiding requires a reason", async () => {
      await asUser(w.finance, async (q) => {
        await expectPgError(q(`delete from public.contributions`), "42501");
      });
      await asUser(w.finance, async (q) => {
        await expectPgError(q(`update public.contributions set status = 'voided' where church_id = $1`, [w.churchA]), "23514");
      });
    });
  });

  describe("pastor", () => {
    it("sees members and confidential notes but not giving", async () => {
      await asUser(w.pastor, async (q) => {
        expect((await q(`select * from public.members`)).length).toBe(3);
        expect(await q(`select * from public.member_notes`)).toHaveLength(2);
        expect(await q(`select * from public.contributions`)).toHaveLength(0);
      });
    });

    it("cannot edit members", async () => {
      await asUser(w.pastor, async (q) => {
        expect(await q(`update public.members set first_name = 'X' returning id`)).toHaveLength(0);
      });
    });
  });

  describe("church admin", () => {
    it("sees general notes; confidential notes need members.view_sensitive", async () => {
      // church_admin holds every permission including view_sensitive
      expect(await asUser(w.adminA, (q) => q(`select * from public.member_notes`))).toHaveLength(2);
    });
  });

  describe("department leader", () => {
    it("only sees departments they lead and those members", async () => {
      await asUser(w.leader, async (q) => {
        const depts = await q<{ name: string }>(`select name from public.departments`);
        expect(depts.map((d) => d.name)).toEqual(["Choir"]);
        const members = await q<{ first_name: string }>(`select first_name from public.members`);
        expect(members.map((m) => m.first_name)).toEqual(["Chidi"]);
        expect(await q(`select * from public.member_notes`)).toHaveLength(0);
      });
    });
  });

  describe("follow-up worker", () => {
    it("only sees assigned people", async () => {
      await asUser(w.worker, async (q) => {
        const visitors = await q<{ first_name: string }>(`select first_name from public.visitors`);
        expect(visitors.map((v) => v.first_name)).toEqual(["Victor"]);
        expect(await q(`select * from public.members`)).toHaveLength(0);
        expect(await q(`select * from public.followups`)).toHaveLength(1);
      });
    });

    it("can complete their follow-up and schedule the next one", async () => {
      await asUser(w.worker, async (q) => {
        const [f] = await q<{ id: string }>(`select id from public.followups`);
        const [next] = await q<{ id: string }>(
          `select public.complete_followup($1, 'whatsapp', 'reached', 'Spoke briefly', current_date + 7) as id`,
          [f.id],
        );
        expect(next.id).toBeTruthy();
        const [v] = await q<{ status: string }>(`select status from public.visitors where id = $1`, [w.visitorA]);
        expect(v.status).toBe("contacted");
      });
    });

    it("cannot reassign a follow-up to someone else", async () => {
      await asUser(w.worker, async (q) => {
        await expectPgError(q(`update public.followups set assigned_to = $1`, [w.pastor]), "42501");
      });
    });

    it("cannot create follow-ups for people not assigned to them", async () => {
      await asUser(w.worker, async (q) => {
        await expectPgError(
          q(`insert into public.followups (church_id, visitor_id, assigned_to) values ($1, $2, $3)`, [w.churchA, w.visitorA2, w.worker]),
          "42501",
        );
      });
    });
  });

  describe("privilege escalation", () => {
    it("users cannot make themselves super admin", async () => {
      await asUser(w.adminA, async (q) => {
        await expectPgError(q(`update public.profiles set is_super_admin = true where id = $1`, [w.adminA]), "42501");
      });
    });

    it("non-admins cannot change roles, including their own", async () => {
      await asUser(w.pastor, async (q) => {
        expect(await q(`update public.church_users set role = 'church_admin' where user_id = $1 returning id`, [w.pastor])).toHaveLength(0);
      });
    });

    it("non-admins cannot add users to a church", async () => {
      await asUser(w.pastor, async (q) => {
        await expectPgError(
          q(`insert into public.church_users (church_id, user_id, role) values ($1, $2, 'church_admin')`, [w.churchA, w.adminB]),
          "42501",
        );
      });
    });

    it("the last church admin cannot be demoted", async () => {
      await asUser(w.adminA, async (q) => {
        await expectPgError(q(`update public.church_users set role = 'pastor' where user_id = $1 and church_id = $2`, [w.adminA, w.churchA]), "P0001");
      });
    });

    it("audit logs cannot be written, edited or deleted by users", async () => {
      await asUser(w.adminA, async (q) => {
        await expectPgError(q(`insert into public.audit_logs (church_id, action, entity_type) values ($1, 'x', 'y')`, [w.churchA]), "42501");
      });
      await asUser(w.adminA, async (q) => {
        await expectPgError(q(`delete from public.audit_logs`), "42501");
      });
      await asUser(w.adminA, async (q) => {
        await expectPgError(q(`update public.audit_logs set action = 'tampered'`), "42501");
      });
    });

    it("members cannot be hard-deleted through the API", async () => {
      await asUser(w.adminA, async (q) => {
        await expectPgError(q(`delete from public.members where id = $1`, [w.otherMember]), "42501");
      });
    });

    it("a church cannot be suspended by its own admin", async () => {
      await asUser(w.adminA, async (q) => {
        await expectPgError(q(`update public.churches set status = 'suspended' where id = $1`, [w.churchA]), "42501");
      });
    });
  });

  describe("audit log", () => {
    it("records member updates and role changes without personal values", async () => {
      await asUser(
        w.adminA,
        async (q) => {
          await q(`update public.members set phone = '+2348000000001', membership_status = 'archived' where id = $1`, [w.otherMember]);
          await q(`update public.church_users set role = 'finance' where user_id = $1 and church_id = $2`, [w.pastor, w.churchA]);
          await q(`update public.church_users set role = 'pastor' where user_id = $1 and church_id = $2`, [w.pastor, w.churchA]);
          await q(`update public.members set membership_status = 'active' where id = $1`, [w.otherMember]);
        },
        { commit: true },
      );
      const logs = await asUser(w.adminA, (q) =>
        q<{ action: string; metadata: Record<string, unknown>; actor_id: string }>(
          `select action, metadata, actor_id from public.audit_logs where church_id = $1 order by created_at`,
          [w.churchA],
        ),
      );
      const archived = logs.find((l) => l.action === "member.archived");
      expect(archived).toBeTruthy();
      expect(archived!.actor_id).toBe(w.adminA);
      expect(JSON.stringify(archived!.metadata)).not.toContain("+2348000000001");
      expect(logs.some((l) => l.action === "user.role_changed")).toBe(true);
      // pastor (no audit.view) sees nothing
      expect(await asUser(w.pastor, (q) => q(`select * from public.audit_logs`))).toHaveLength(0);
    });
  });
});
