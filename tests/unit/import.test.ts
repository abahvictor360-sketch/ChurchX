import { describe, expect, it } from "vitest";
import { canonicalColumn, mapRow, normalizeDate, normalizeGender, normalizeStatus } from "@/lib/import";
import { parseCsv, toCsv } from "@/lib/csv";

describe("CSV import helpers", () => {
  it("parses common date formats", () => {
    expect(normalizeDate("14/02/1990")).toBe("1990-02-14");
    expect(normalizeDate("1990-02-14")).toBe("1990-02-14");
    expect(normalizeDate("5-6-95")).toBe("1995-06-05");
    expect(normalizeDate("")).toBeNull();
    expect(normalizeDate("31/02/2020")).toBeUndefined();
    expect(normalizeDate("not a date")).toBeUndefined();
  });
  it("normalises gender and status", () => {
    expect(normalizeGender("M")).toBe("male");
    expect(normalizeGender("Female")).toBe("female");
    expect(normalizeGender("")).toBeNull();
    expect(normalizeGender("x")).toBeUndefined();
    expect(normalizeStatus("New Member")).toBe("new_member");
    expect(normalizeStatus("")).toBe("active");
    expect(normalizeStatus("vip")).toBeUndefined();
  });
  it("maps header aliases and splits full names", () => {
    expect(canonicalColumn("Surname")).toBe("last_name");
    expect(canonicalColumn("Phone Number")).toBe("phone");
    expect(canonicalColumn("Unknown")).toBeNull();
    expect(mapRow({ name: "Ada Grace Obi", mobile: "0803" })).toEqual({ first_name: "Ada", middle_name: "Grace", last_name: "Obi", phone: "0803" });
  });
  it("round-trips CSV and neutralises formula injection", () => {
    const csv = toCsv([{ a: "=HYPERLINK(\"x\")", b: "plain" }], [{ key: "a", label: "A" }, { key: "b", label: "B" }]);
    expect(csv).toContain("'=HYPERLINK");
    const parsed = parseCsv("First Name,Last Name\nAda,Obi\n");
    expect(parsed.rows).toEqual([{ first_name: "Ada", last_name: "Obi" }]);
  });
});
