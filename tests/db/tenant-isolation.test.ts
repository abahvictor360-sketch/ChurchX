import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildWorld, type World } from "./fixtures";
import { asAdmin, asUser, closePool, expectPgError, hasDb } from "./helpers";

/**
 * MANDATORY: User A (Church A) must never query, modify, search or export
 * Church B data — at the database level, regardless of the UI.
 */
describe.skipIf(!hasDb)("tenant isolation", () => {
  let w: World;
  beforeAll(async () => {
    w = await buildWorld();
  });
  afterAll(closePool);

  const tenantTables = [
    "members",
    "visitors",
    "departments",
    "department_members",
    "services",
    "service_types",
    "attendance",
    "followups",
    "events",
    "event_registrations",
    "giving_categories",
    "contributions",
    "member_notes",
    "member_care_alerts",
    "audit_logs",
    "church_settings",
    "notifications",
  ];

  it.each(tenantTables)("User A cannot read Church B rows from %s", async (table) => {
    const rows = await asUser(w.adminA, (q) =>
      q<{ n: string }>(`select count(*)::text as n from public.${table} where church_id = $1`, [w.churchB]),
    );
    expect(rows[0].n).toBe("0");
  });

  it("User A cannot read Church B's church record or users", async () => {
    await asUser(w.adminA, async (q) => {
      expect(await q(`select id from public.churches where id = $1`, [w.churchB])).toHaveLength(0);
      expect(await q(`select id from public.church_users where church_id = $1`, [w.churchB])).toHaveLength(0);
      expect(await q(`select id from public.profiles where id = $1`, [w.adminB])).toHaveLength(0);
    });
  });

  it("User A only ever sees their own church when selecting without filters", async () => {
    const churches = await asUser(w.adminA, (q) => q<{ id: string }>(`select distinct church_id as id from public.members`));
    expect(churches.map((c) => c.id)).toEqual([w.churchA]);
  });

  it("User A cannot insert rows into Church B", async () => {
    await asUser(w.adminA, async (q) => {
      await expectPgError(
        q(`insert into public.members (church_id, first_name, last_name) values ($1, 'Evil', 'Insert')`, [w.churchB]),
        "42501",
      );
    });
    await asUser(w.adminA, async (q) => {
      await expectPgError(
        q(`insert into public.visitors (church_id, first_name) values ($1, 'Evil')`, [w.churchB]),
        "42501",
      );
    });
    await asUser(w.adminA, async (q) => {
      await expectPgError(
        q(
          `insert into public.contributions (church_id, category_id, amount, currency, payment_method) values ($1, $2, 1, 'NGN', 'cash')`,
          [w.churchB, w.categoryB],
        ),
        "42501",
      );
    });
  });

  it("User A cannot update or archive Church B rows", async () => {
    await asUser(
      w.adminA,
      async (q) => {
        const updated = await q(`update public.members set membership_status = 'archived' where id = $1 returning id`, [w.memberB]);
        expect(updated).toHaveLength(0);
        const updatedChurch = await q(`update public.churches set name = 'Hacked' where id = $1 returning id`, [w.churchB]);
        expect(updatedChurch).toHaveLength(0);
      },
      { commit: true },
    );
    const [m] = await asAdmin<{ membership_status: string }>(`select membership_status from public.members where id = $1`, [w.memberB]);
    expect(m.membership_status).toBe("active");
  });

  it("User A cannot move their own rows into Church B", async () => {
    await asUser(w.adminA, async (q) => {
      await expectPgError(q(`update public.members set church_id = $1 where id = $2`, [w.churchB, w.choirMember]));
    });
  });

  it("composite foreign keys block linking Church A records to Church B people", async () => {
    // RLS allows the insert into Church A, but the referenced member belongs to Church B.
    await asUser(w.adminA, async (q) => {
      await expectPgError(
        q(`insert into public.attendance (church_id, service_id, member_id) values ($1, $2, $3)`, [w.churchA, w.serviceA, w.memberB]),
        "23503",
      );
    });
    await asUser(w.adminA, async (q) => {
      await expectPgError(
        q(`insert into public.followups (church_id, member_id, assigned_to) values ($1, $2, $3)`, [w.churchA, w.memberB, w.adminA]),
        "23503",
      );
    });
    // Cannot assign a follow-up to a user of another church either.
    await asUser(w.adminA, async (q) => {
      await expectPgError(
        q(`insert into public.followups (church_id, member_id, assigned_to) values ($1, $2, $3)`, [w.churchA, w.choirMember, w.adminB]),
        "23503",
      );
    });
  });

  it("global search never returns Church B results", async () => {
    await asUser(w.adminA, async (q) => {
      expect(await q(`select * from public.global_search($1, 'Bisi')`, [w.churchB])).toHaveLength(0);
      expect(await q(`select * from public.global_search($1, 'Bisi')`, [w.churchA])).toHaveLength(0);
      const own = await q<{ title: string }>(`select * from public.global_search($1, 'Chidi')`, [w.churchA]);
      expect(own.map((r) => r.title)).toContain("Chidi Choir");
    });
  });

  it("SECURITY DEFINER RPCs refuse Church B for User A", async () => {
    const calls: [string, unknown[]][] = [
      [`select public.dashboard_summary($1)`, [w.churchB]],
      [`select public.refresh_member_care($1, true)`, [w.churchB]],
      [`select * from public.lookup_people($1, 'b')`, [w.churchB]],
      [`select * from public.checkin_search($1, '')`, [w.serviceB]],
      [`select * from public.service_attendance_list($1)`, [w.serviceB]],
      [`select * from public.report_attendance($1, current_date - 30, current_date)`, [w.churchB]],
      [`select * from public.report_member_growth($1, current_date - 30, current_date)`, [w.churchB]],
      [`select public.report_giving_summary($1)`, [w.churchB]],
      [`select * from public.report_giving_breakdown($1, current_date - 30, current_date)`, [w.churchB]],
      [`select public.report_retention($1)`, [w.churchB]],
      [`select * from public.report_followup_performance($1, current_date - 30, current_date)`, [w.churchB]],
    ];
    for (const [sql, params] of calls) {
      await asUser(w.adminA, async (q) => {
        await expectPgError(q(sql, params), "42501");
      });
    }
  });

  it("User A cannot convert or complete Church B visitors/follow-ups", async () => {
    await asUser(w.adminA, async (q) => {
      // RLS hides the visitor entirely, so it reads as "not found".
      await expectPgError(q(`select public.convert_visitor_to_member($1)`, [w.visitorB]), "P0002");
    });
    await asUser(w.adminA, async (q) => {
      await expectPgError(q(`select public.bulk_mark_attendance($1, array[$2]::uuid[])`, [w.serviceB, w.memberB]), "P0002");
    });
  });

  it("CSV export queries (plain selects) cannot include Church B data", async () => {
    const rows = await asUser(w.adminA, (q) =>
      q<{ church_id: string }>(`select church_id from public.members union all select church_id from public.contributions`),
    );
    expect(rows.every((r) => r.church_id === w.churchA)).toBe(true);
  });

  it("storage objects are scoped by church folder", async () => {
    await asUser(w.adminA, async (q) => {
      await q(`insert into storage.objects (bucket_id, name) values ('member-photos', $1)`, [`${w.churchA}/m/photo.jpg`]);
      await expectPgError(
        q(`insert into storage.objects (bucket_id, name) values ('member-photos', $1)`, [`${w.churchB}/m/photo.jpg`]),
        "42501",
      );
    });
  });

  it("anonymous users cannot read anything", async () => {
    await asUser(null, async (q) => {
      await expectPgError(q(`select * from public.members`), "42501");
    });
    await asUser(null, async (q) => {
      await expectPgError(q(`select public.dashboard_summary($1)`, [w.churchA]), "42501");
    });
  });
});
