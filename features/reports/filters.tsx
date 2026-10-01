import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MEMBER_STATUSES } from "@/lib/validation";
import { titleCase } from "@/lib/format";

export type ReportFilterValues = {
  from: string;
  to: string;
  bucket: "week" | "month";
  service_type?: string;
  department?: string;
  member_status?: string;
};

const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

export function parseReportFilters(sp: Record<string, string | string[] | undefined>, defaults: { from: string; to: string }): ReportFilterValues {
  let from = isDate(sp.from) ? (sp.from as string) : defaults.from;
  let to = isDate(sp.to) ? (sp.to as string) : defaults.to;
  if (from > to) [from, to] = [to, from];
  return {
    from,
    to,
    bucket: sp.bucket === "week" ? "week" : "month",
    service_type: isUuid(sp.service_type) ? (sp.service_type as string) : undefined,
    department: isUuid(sp.department) ? (sp.department as string) : undefined,
    member_status: typeof sp.member_status === "string" && (MEMBER_STATUSES as readonly string[]).includes(sp.member_status) ? sp.member_status : undefined,
  };
}

export function toQuery(f: Partial<ReportFilterValues>) {
  return new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
}

const sel = "h-10 w-full rounded-md border bg-card px-2 text-sm text-foreground sm:h-9";

export function ReportFilters({
  values,
  action,
  serviceTypes,
  departments,
  showPeopleFilters = true,
}: {
  values: ReportFilterValues;
  action: string;
  serviceTypes?: { id: string; name: string }[];
  departments?: { id: string; name: string }[];
  showPeopleFilters?: boolean;
}) {
  return (
    <form action={action} className="mb-4 grid grid-cols-2 gap-2 rounded-lg border bg-card p-3 sm:grid-cols-3 lg:grid-cols-7 lg:items-end">
      <label className="grid gap-1 text-xs text-muted-foreground">
        From
        <Input type="date" name="from" defaultValue={values.from} />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        To
        <Input type="date" name="to" defaultValue={values.to} />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Group by
        <select name="bucket" defaultValue={values.bucket} className={sel}>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
      </label>
      {showPeopleFilters && (
        <>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Service type
            <select name="service_type" defaultValue={values.service_type ?? ""} className={sel}>
              <option value="">All</option>
              {(serviceTypes ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Department
            <select name="department" defaultValue={values.department ?? ""} className={sel}>
              <option value="">All</option>
              {(departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Member status
            <select name="member_status" defaultValue={values.member_status ?? ""} className={sel}>
              <option value="">All</option>
              {MEMBER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <div className="col-span-2 flex gap-2 sm:col-span-1">
        <Button type="submit" className="flex-1">
          Apply
        </Button>
        <Button asChild variant="ghost">
          <Link href={action}>Reset</Link>
        </Button>
      </div>
    </form>
  );
}
