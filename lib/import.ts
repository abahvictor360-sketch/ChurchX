/** Pure helpers for CSV member import (unit tested). */

export const MEMBER_IMPORT_COLUMNS = [
  "first_name",
  "middle_name",
  "last_name",
  "gender",
  "date_of_birth",
  "phone",
  "email",
  "address",
  "city",
  "state",
  "country",
  "marital_status",
  "membership_status",
  "membership_number",
  "join_date",
  "occupation",
  "emergency_contact_name",
  "emergency_contact_phone",
] as const;

const ALIASES: Record<string, string> = {
  firstname: "first_name",
  first: "first_name",
  given_name: "first_name",
  surname: "last_name",
  lastname: "last_name",
  last: "last_name",
  family_name: "last_name",
  middlename: "middle_name",
  other_names: "middle_name",
  sex: "gender",
  dob: "date_of_birth",
  birthday: "date_of_birth",
  birth_date: "date_of_birth",
  phone_number: "phone",
  mobile: "phone",
  telephone: "phone",
  email_address: "email",
  status: "membership_status",
  member_status: "membership_status",
  member_no: "membership_number",
  member_number: "membership_number",
  date_joined: "join_date",
  joined: "join_date",
  joined_on: "join_date",
  marital: "marital_status",
  profession: "occupation",
};

export function canonicalColumn(header: string) {
  const h = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if ((MEMBER_IMPORT_COLUMNS as readonly string[]).includes(h)) return h;
  return ALIASES[h] ?? null;
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, D/M/YY. Returns ISO date or null; undefined if unparseable. */
export function normalizeDate(raw: string | undefined | null): string | null | undefined {
  const v = (raw ?? "").trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  let match = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/))) {
    d = Number(match[1]);
    m = Number(match[2]);
    y = Number(match[3]);
    if (y < 100) y += y > 30 ? 1900 : 2000;
  } else return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function normalizeGender(raw: string | undefined | null) {
  const v = (raw ?? "").trim().toLowerCase();
  if (["m", "male", "man", "boy"].includes(v)) return "male";
  if (["f", "female", "woman", "girl"].includes(v)) return "female";
  return v ? undefined : null;
}

export function normalizeStatus(raw: string | undefined | null) {
  const v = (raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!v) return "active";
  const map: Record<string, string> = { new: "new_member", newmember: "new_member", member: "active", worker: "active" };
  const s = map[v] ?? v;
  return ["visitor", "new_member", "active", "inactive", "transferred", "archived"].includes(s) ? s : undefined;
}

/** Maps a raw CSV row (any headers) to canonical member fields. */
export function mapRow(row: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const col = canonicalColumn(key);
    if (col && value != null && String(value).trim() !== "") out[col] = String(value).trim();
  }
  // "Name" / "Full name" column split into first + last
  const full = row.name ?? row.full_name ?? row["Full Name"] ?? row.Name;
  if (!out.first_name && full) {
    const parts = String(full).trim().split(/\s+/);
    out.first_name = parts[0];
    if (parts.length > 1) out.last_name = parts[parts.length - 1];
    if (parts.length > 2) out.middle_name = parts.slice(1, -1).join(" ");
  }
  return out;
}

export function templateCsv() {
  return `${MEMBER_IMPORT_COLUMNS.join(",")}\nAdaeze,,Okafor,female,14/02/1990,08031234567,adaeze@example.com,12 Allen Avenue,Ikeja,Lagos,Nigeria,married,active,,01/01/2024,Teacher,Chidi Okafor,08039876543\n`;
}
