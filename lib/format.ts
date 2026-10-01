import { differenceInYears, format, formatDistanceToNowStrict, parseISO } from "date-fns";

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  // Plain dates (YYYY-MM-DD) are calendar dates — parse as local, not UTC.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(value) : new Date(value);
}

export function formatDate(value: string | Date | null | undefined, pattern = "d MMM yyyy") {
  const d = toDate(value);
  return d ? format(d, pattern) : "—";
}

export function formatDateTime(value: string | Date | null | undefined) {
  return formatDate(value, "d MMM yyyy, h:mm a");
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return format(d, "h:mm a");
}

export function timeAgo(value: string | Date | null | undefined) {
  const d = toDate(value);
  return d ? `${formatDistanceToNowStrict(d)} ago` : "—";
}

export function age(dob: string | null | undefined) {
  const d = toDate(dob);
  return d ? differenceInYears(new Date(), d) : null;
}

export function formatMoney(amount: number | string | null | undefined, currency = "NGN", compact = false) {
  const n = Number(amount ?? 0);
  if (compact && Math.abs(n) < 10000) compact = false;
  try {
    return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en", {
      style: "currency",
      currency,
      maximumFractionDigits: compact ? 1 : Number.isInteger(n) ? 0 : 2,
      notation: compact ? "compact" : "standard",
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

export function formatNumber(n: number | string | null | undefined) {
  return new Intl.NumberFormat("en").format(Number(n ?? 0));
}

export function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function titleCase(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Today's date (YYYY-MM-DD) in a church's timezone. */
export function todayIn(timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function addDays(isoDate: string, days: number) {
  const d = parseISO(isoDate);
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}
