import { describe, expect, it } from "vitest";
import { contributionSchema, eventSchema, memberSchema, passwordSchema, serviceSchema, careRulesSchema } from "@/lib/validation";
import { safeNext } from "@/features/auth/safe-next";
import { hasAny } from "@/lib/permissions";
import { friendlyError } from "@/lib/actions";

describe("member validation", () => {
  const schema = memberSchema("Nigeria");
  it("requires names and normalises phone/email", () => {
    const r = schema.safeParse({ first_name: " Ada ", last_name: "Obi", phone: "0803 123 4567", email: "ADA@Example.com", join_date: "2025-01-01" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.first_name).toBe("Ada");
      expect(r.data.phone).toBe("+2348031234567");
      expect(r.data.email).toBe("ada@example.com");
      expect(r.data.middle_name).toBeNull();
    }
  });
  it("rejects missing names, bad phone and future birth dates", () => {
    const r = schema.safeParse({ first_name: "", last_name: "", phone: "12", date_of_birth: "2999-01-01", join_date: "2025-01-01" });
    expect(r.success).toBe(false);
    const fields = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["first_name", "last_name", "phone", "date_of_birth"]));
  });
});

describe("other schemas", () => {
  it("contribution amounts are positive and rounded; anonymous cannot link a member", () => {
    const base = { category_id: "7a1c1a3e-6f7e-4a63-9a8c-0f2b3c4d5e6f", contribution_date: "2026-01-01", payment_method: "cash" };
    const ok = contributionSchema.safeParse({ ...base, amount: "12,500.555", is_anonymous: "on" });
    expect(ok.success && ok.data.amount).toBe(12500.56);
    expect(contributionSchema.safeParse({ ...base, amount: "-5" }).success).toBe(false);
    expect(contributionSchema.safeParse({ ...base, amount: "10", is_anonymous: "on", member_id: base.category_id }).success).toBe(false);
  });
  it("service end must be after start; event end not before start", () => {
    expect(serviceSchema.safeParse({ name: "Sunday", service_date: "2026-01-04", start_time: "10:00", end_time: "09:00" }).success).toBe(false);
    expect(eventSchema.safeParse({ name: "Retreat", start_date: "2026-02-02", end_date: "2026-02-01" }).success).toBe(false);
  });
  it("care rules: long absence must exceed first threshold", () => {
    const r = careRulesSchema.safeParse({ absent_consecutive: 4, absent_long: 3, visitor_contact_days: 2, attendance_drop_pct: 50, birthday_lookahead_days: 7, no_department_after_days: 14 });
    expect(r.success).toBe(false);
  });
  it("password policy", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("longpassword").success).toBe(false);
    expect(passwordSchema.safeParse("Password123").success).toBe(true);
  });
});

describe("security helpers", () => {
  it("safeNext blocks open redirects", () => {
    expect(safeNext("/members")).toBe("/members");
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("https://evil.com")).toBe("/dashboard");
    expect(safeNext("/\\evil.com")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
  });
  it("hasAny checks permission sets", () => {
    const perms = new Set(["members.view"]);
    expect(hasAny(perms, ["members.view", "giving.view"])).toBe(true);
    expect(hasAny(perms, ["giving.view"])).toBe(false);
    expect(hasAny(perms, undefined)).toBe(true);
  });
  it("friendlyError never leaks raw database messages", () => {
    const msg = friendlyError({ code: "23505", message: 'duplicate key value violates unique constraint "members_church_id_membership_number_key"' });
    expect(msg).toBe("This record already exists.");
    expect(friendlyError({ code: "42501", message: "permission denied for table x" })).toBe("You do not have permission to do this.");
    expect(friendlyError({ code: "P0001", message: "This event is full (capacity 10)" })).toBe("This event is full (capacity 10)");
  });
});
