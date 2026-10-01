import { describe, expect, it } from "vitest";
import { normalizePhone, whatsappLink } from "@/lib/phone";

describe("normalizePhone", () => {
  it("converts Nigerian local numbers to international format", () => {
    expect(normalizePhone("0803 123 4567")).toBe("+2348031234567");
    expect(normalizePhone("08031234567", "Nigeria")).toBe("+2348031234567");
  });
  it("keeps international numbers", () => {
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("00233241234567")).toBe("+233241234567");
  });
  it("uses the church country for local numbers", () => {
    expect(normalizePhone("0241234567", "Ghana")).toBe("+233241234567");
  });
  it("returns null for empty and undefined for invalid input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone("12")).toBeUndefined();
  });
});

describe("whatsappLink", () => {
  it("builds a wa.me link without sending anything", () => {
    expect(whatsappLink("+2348031234567", "Hello")).toBe("https://wa.me/2348031234567?text=Hello");
    expect(whatsappLink(null)).toBeNull();
  });
});
