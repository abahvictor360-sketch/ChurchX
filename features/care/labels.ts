export const CARE_LABELS: Record<string, { label: string; short: string }> = {
  absent_consecutive: { label: "Absent for recent services", short: "Recently absent" },
  absent_long: { label: "Absent for a long stretch", short: "Long absence" },
  attendance_drop: { label: "Attendance has dropped", short: "Attendance dropped" },
  visitor_not_contacted: { label: "Visitor not yet contacted", short: "Visitor awaiting contact" },
  followup_overdue: { label: "Follow-up overdue", short: "Follow-up overdue" },
  birthday_today: { label: "Birthday today", short: "Birthday today" },
  birthday_week: { label: "Birthday this week", short: "Birthday soon" },
  no_department: { label: "New member without a department", short: "No department" },
};

export const CARE_ORDER = [
  "absent_long",
  "absent_consecutive",
  "attendance_drop",
  "visitor_not_contacted",
  "followup_overdue",
  "no_department",
  "birthday_today",
  "birthday_week",
];
