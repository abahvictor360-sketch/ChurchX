import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";

type Variant = React.ComponentProps<typeof Badge>["variant"];

const MAP: Record<string, Variant> = {
  // membership
  active: "green",
  new_member: "blue",
  visitor: "orange",
  inactive: "yellow",
  transferred: "gray",
  archived: "gray",
  // visitors
  new: "orange",
  contacted: "blue",
  followup_ongoing: "teal",
  interested: "green",
  converted: "green",
  not_interested: "gray",
  unreachable: "red",
  // follow-ups / generic
  pending: "yellow",
  completed: "green",
  cancelled: "gray",
  overdue: "red",
  // services
  scheduled: "blue",
  ongoing: "orange",
  // attendance
  present: "green",
  absent: "red",
  excused: "yellow",
  // giving
  recorded: "green",
  voided: "gray",
  // users
  invited: "yellow",
  disabled: "gray",
  open: "orange",
  closed: "gray",
  resolved: "green",
  auto_resolved: "gray",
};

const LABEL: Record<string, string> = {
  followup_ongoing: "Follow-up ongoing",
  unreachable: "Unable to reach",
  converted: "Converted to member",
  auto_resolved: "Auto-resolved",
};

/** Status shown as text + colour (never colour alone). */
export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return null;
  return (
    <Badge variant={MAP[status] ?? "gray"} className={className}>
      {LABEL[status] ?? titleCase(status)}
    </Badge>
  );
}
