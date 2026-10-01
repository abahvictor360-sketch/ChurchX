import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

/** Empty strings → null, strings trimmed. */
const blankToNull = (v: unknown) => {
  if (typeof v !== "string") return v ?? null;
  const t = v.trim();
  return t === "" ? null : t;
};

export const optionalText = (max = 500) =>
  z.preprocess(blankToNull, z.string().max(max, `Must be ${max} characters or fewer`).nullable());

export const requiredText = (label: string, max = 120) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string({ error: `${label} is required` }).min(1, `${label} is required`).max(max, `${label} is too long`),
  );

export const optionalEmail = z.preprocess(
  (v) => (typeof v === "string" ? blankToNull(v.toLowerCase()) : v ?? null),
  z.email("Enter a valid email address").max(254).nullable(),
);

export const optionalDate = z.preprocess(
  blankToNull,
  z.iso.date("Enter a valid date").nullable(),
);

export const requiredDate = (label: string) =>
  z.preprocess(blankToNull, z.iso.date(`${label} is required`));

export const optionalTime = z.preprocess(
  blankToNull,
  z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Enter a valid time").nullable(),
);

export const optionalUuid = z.preprocess(blankToNull, z.uuid().nullable());
export const uuid = z.uuid("Invalid selection");

export function phoneField(country?: string | null) {
  return z.preprocess(blankToNull, z.string().nullable()).transform((v, ctx) => {
    const normalized = normalizePhone(v, country);
    if (normalized === undefined) {
      ctx.addIssue({ code: "custom", message: "Enter a valid phone number, e.g. 0803 123 4567" });
      return z.NEVER;
    }
    return normalized;
  });
}

export const GENDERS = ["male", "female"] as const;
export const MARITAL = ["single", "married", "widowed", "divorced", "separated"] as const;
export const MEMBER_STATUSES = ["visitor", "new_member", "active", "inactive", "transferred", "archived"] as const;
export const VISITOR_STATUSES = [
  "new",
  "contacted",
  "followup_ongoing",
  "interested",
  "converted",
  "not_interested",
  "unreachable",
] as const;
export const CONTACT_METHODS = ["phone", "whatsapp", "sms", "email", "visit", "other"] as const;
export const OUTCOMES = [
  "reached",
  "no_answer",
  "wrong_number",
  "call_back",
  "interested",
  "not_interested",
  "prayer_needed",
  "visited",
  "other",
] as const;
export const SERVICE_STATUSES = ["scheduled", "ongoing", "completed", "cancelled"] as const;
export const ATTENDANCE_STATUSES = ["present", "absent", "excused"] as const;
export const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "pos", "online", "other"] as const;

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(blankToNull, z.enum(values).nullable());

export function memberSchema(country?: string | null) {
  return z.object({
    first_name: requiredText("First name", 80),
    middle_name: optionalText(80),
    last_name: requiredText("Last name", 80),
    gender: optionalEnum(GENDERS),
    date_of_birth: optionalDate.refine((d) => !d || d <= new Date().toISOString().slice(0, 10), "Date of birth cannot be in the future"),
    phone: phoneField(country),
    email: optionalEmail,
    address: optionalText(300),
    city: optionalText(80),
    state: optionalText(80),
    country: optionalText(80),
    marital_status: optionalEnum(MARITAL),
    membership_status: z.enum(MEMBER_STATUSES).default("new_member"),
    membership_number: optionalText(30),
    join_date: requiredDate("Join date"),
    occupation: optionalText(120),
    emergency_contact_name: optionalText(120),
    emergency_contact_phone: phoneField(country),
    notes: optionalText(4000),
  });
}
export type MemberInput = z.infer<ReturnType<typeof memberSchema>>;

export function visitorSchema(country?: string | null) {
  return z.object({
    first_name: requiredText("First name", 80),
    last_name: optionalText(80),
    phone: phoneField(country),
    email: optionalEmail,
    gender: optionalEnum(GENDERS),
    address: optionalText(300),
    heard_about: optionalText(200),
    service_id: optionalUuid,
    prayer_request: optionalText(2000),
    invited_by: optionalText(160),
    visit_date: requiredDate("Visit date"),
  });
}

export const visitorStatusSchema = z.object({ status: z.enum(VISITOR_STATUSES).exclude(["converted"]) });

export const noteSchema = z.object({
  body: requiredText("Note", 4000),
  visibility: z.enum(["general", "confidential"]).default("general"),
});

export const assignFollowupSchema = z
  .object({
    assignee: uuid,
    member_ids: z.array(z.uuid()).max(200).default([]),
    visitor_ids: z.array(z.uuid()).max(200).default([]),
    due_date: requiredDate("Due date"),
    notes: optionalText(1000),
    care_alert_id: optionalUuid,
  })
  .refine((v) => v.member_ids.length + v.visitor_ids.length > 0, { message: "Choose at least one person", path: ["people"] });

export const completeFollowupSchema = z.object({
  followup_id: uuid,
  contact_method: z.enum(CONTACT_METHODS, { error: "Choose how you made contact" }),
  outcome: z.enum(OUTCOMES, { error: "Choose an outcome" }),
  notes: optionalText(4000),
  next_followup_date: optionalDate,
  visitor_status: optionalEnum(VISITOR_STATUSES),
});

export const serviceTypeSchema = z.object({
  name: requiredText("Name", 80),
  description: optionalText(300),
  default_day: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(6).nullable()),
  default_start_time: optionalTime,
  default_end_time: optionalTime,
  include_in_care: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const serviceSchema = z
  .object({
    name: requiredText("Service name", 120),
    service_type_id: optionalUuid,
    service_date: requiredDate("Date"),
    start_time: optionalTime,
    end_time: optionalTime,
    location: optionalText(200),
    notes: optionalText(2000),
    status: z.enum(SERVICE_STATUSES).default("scheduled"),
  })
  .refine((v) => !v.start_time || !v.end_time || v.end_time > v.start_time, {
    message: "End time must be after start time",
    path: ["end_time"],
  });

export const departmentSchema = z
  .object({
    name: requiredText("Department name", 80),
    description: optionalText(1000),
    leader_member_id: optionalUuid,
    assistant_member_id: optionalUuid,
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .refine((v) => !v.leader_member_id || v.leader_member_id !== v.assistant_member_id, {
    message: "Leader and assistant must be different people",
    path: ["assistant_member_id"],
  });

export const eventSchema = z
  .object({
    name: requiredText("Event name", 160),
    description: optionalText(4000),
    start_date: requiredDate("Start date"),
    end_date: requiredDate("End date"),
    start_time: optionalTime,
    end_time: optionalTime,
    venue: optionalText(200),
    capacity: z.preprocess(blankToNull, z.coerce.number().int("Whole number only").positive("Must be at least 1").max(1_000_000).nullable()),
    registration_status: z.enum(["open", "closed"]).default("open"),
    status: z.enum(["scheduled", "completed", "cancelled"]).default("scheduled"),
  })
  .refine((v) => v.end_date >= v.start_date, { message: "End date cannot be before start date", path: ["end_date"] });

export function registrationSchema(country?: string | null) {
  return z
    .object({
      member_id: optionalUuid,
      visitor_id: optionalUuid,
      guest_name: optionalText(160),
      guest_phone: phoneField(country),
      guest_email: optionalEmail,
    })
    .refine((v) => [v.member_id, v.visitor_id, v.guest_name].filter(Boolean).length === 1, {
      message: "Choose a person or enter a guest name",
      path: ["guest_name"],
    });
}

export const contributionSchema = z
  .object({
    member_id: optionalUuid,
    is_anonymous: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
    contributor_name: optionalText(160),
    category_id: uuid,
    amount: z.preprocess(
      (v) => (typeof v === "string" ? v.replace(/[,\s]/g, "") : v),
      z.coerce.number({ error: "Enter an amount" }).positive("Amount must be greater than 0").max(999_999_999_999, "Amount is too large"),
    ),
    contribution_date: requiredDate("Date"),
    payment_method: z.enum(PAYMENT_METHODS, { error: "Choose a payment method" }),
    reference: optionalText(120),
    notes: optionalText(1000),
  })
  .refine((v) => !(v.is_anonymous && v.member_id), { message: "Anonymous gifts cannot be linked to a member", path: ["member_id"] })
  .transform((v) => ({ ...v, amount: Math.round(v.amount * 100) / 100 }));

export const voidContributionSchema = z.object({ id: uuid, reason: requiredText("Reason", 300) });

export const categorySchema = z.object({
  name: requiredText("Name", 60),
  description: optionalText(300),
  is_active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const CURRENCIES = ["NGN", "GHS", "KES", "ZAR", "UGX", "USD", "GBP", "EUR", "CAD"] as const;

export const churchProfileSchema = z.object({
  name: requiredText("Church name", 160),
  country: optionalText(80),
  state: optionalText(80),
  city: optionalText(80),
  address: optionalText(300),
  phone: optionalText(30),
  email: optionalEmail,
  website: z.preprocess(blankToNull, z.url("Enter a full URL, e.g. https://example.org").max(200).nullable()),
  timezone: requiredText("Timezone", 64),
  currency: z.enum(CURRENCIES),
});

export const onboardingSchema = churchProfileSchema.extend({
  service_days: z.array(z.coerce.number().int().min(0).max(6)).max(7).default([0]),
});

export const careRulesSchema = z
  .object({
    absent_consecutive: z.coerce.number().int().min(1).max(20),
    absent_long: z.coerce.number().int().min(2).max(52),
    visitor_contact_days: z.coerce.number().int().min(0).max(30),
    attendance_drop_pct: z.coerce.number().int().min(10).max(100),
    birthday_lookahead_days: z.coerce.number().int().min(1).max(31),
    no_department_after_days: z.coerce.number().int().min(0).max(365),
  })
  .refine((v) => v.absent_long > v.absent_consecutive, {
    message: "Must be greater than the first absence threshold",
    path: ["absent_long"],
  });

export const inviteSchema = z.object({
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email("Enter a valid email address")),
  full_name: optionalText(120),
  role: z.enum(["church_admin", "pastor", "finance", "department_leader", "followup_worker", "attendance_worker"]),
  member_id: optionalUuid,
});

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

/** FormData → plain object (repeated keys become arrays when listed). */
export function formToObject(formData: FormData, arrayKeys: string[] = []) {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue;
    out[key] = arrayKeys.includes(key) ? formData.getAll(key) : formData.get(key);
  }
  for (const key of arrayKeys) if (!(key in out)) out[key] = [];
  return out;
}
