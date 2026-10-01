import Link from "next/link";
import { Church, ClipboardCheck } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { ServiceDialog } from "@/features/services/service-dialog";
import { GenerateServicesButton } from "@/features/services/service-controls";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Pagination, pageRange, parsePage } from "@/components/app/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate, formatTime, todayIn } from "@/lib/format";

export const metadata = { title: "Services" };

export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  const ctx = await requireChurch("services.view", "services.manage");
  const sp = await searchParams;
  const tab = sp.tab === "past" ? "past" : "upcoming";
  const type = typeof sp.type === "string" ? sp.type : undefined;
  const page = parsePage(sp.page);
  const today = todayIn(ctx.church.timezone);
  const supabase = await createClient();
  const { from, to } = pageRange(page);

  let q = supabase
    .from("services")
    .select("id, name, service_date, start_time, end_time, location, status, service_types(name)", { count: "exact" })
    .eq("church_id", ctx.church.id);
  q = tab === "upcoming" ? q.gte("service_date", today).order("service_date").order("start_time") : q.lt("service_date", today).order("service_date", { ascending: false });
  if (type) q = q.eq("service_type_id", type);
  const [{ data, count, error }, { data: types }] = await Promise.all([
    q.range(from, to),
    supabase.from("service_types").select("id, name, default_start_time, default_end_time").eq("church_id", ctx.church.id).eq("is_active", true).order("name"),
  ]);
  const canManage = ctx.can("services.manage");
  const canAttend = ctx.can("attendance.record", "attendance.view");

  return (
    <>
      <PageHeader
        title="Services"
        crumbs={[{ label: "Church" }, { label: "Services" }]}
        actions={
          canManage ? (
            <>
              <GenerateServicesButton />
              <ServiceDialog types={types ?? []} today={today} autoOpen={sp.new === "1"} />
            </>
          ) : undefined
        }
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <nav className="flex gap-1 border-b" aria-label="Service period">
          {(["upcoming", "past"] as const).map((t) => (
            <Link
              key={t}
              href={`/services?tab=${t}${type ? `&type=${type}` : ""}`}
              aria-current={tab === t ? "page" : undefined}
              className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize", tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
            >
              {t}
            </Link>
          ))}
        </nav>
        <form action="/services" className="flex items-center gap-2 text-sm">
          <input type="hidden" name="tab" value={tab} />
          <label htmlFor="type" className="sr-only">
            Service type
          </label>
          <select id="type" name="type" defaultValue={type ?? ""} className="h-9 rounded-md border bg-card px-2">
            <option value="">All types</option>
            {(types ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" type="submit">
            Filter
          </Button>
        </form>
      </div>
      <Card className="overflow-hidden">
        {error ? (
          <EmptyState title="Couldn't load services" />
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            icon={Church}
            title={tab === "upcoming" ? "No upcoming services" : "No past services"}
            description={canManage ? "Schedule a service or use Auto-schedule to create them from your usual service days." : undefined}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Time</TableHead>
                  <TableHead className="hidden md:table-cell">Location</TableHead>
                  <TableHead>Status</TableHead>
                  {canAttend && <TableHead className="text-right">Attendance</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/services/${s.id}`} className="font-medium hover:text-primary">
                        {s.name}
                      </Link>
                      {s.service_types?.name && s.service_types.name !== s.name && <p className="text-xs text-muted-foreground">{s.service_types.name}</p>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(s.service_date, "EEE d MMM yyyy")}
                      {s.service_date === today && <span className="ml-1.5 text-xs font-semibold text-primary">Today</span>}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap sm:table-cell">{s.start_time ? `${formatTime(s.start_time)}${s.end_time ? ` – ${formatTime(s.end_time)}` : ""}` : "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{s.location ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    {canAttend && (
                      <TableCell className="text-right">
                        {s.status !== "cancelled" && (
                          <Button asChild size="sm" variant={s.service_date === today ? "default" : "outline"}>
                            <Link href={`/attendance/${s.id}`}>
                              <ClipboardCheck /> <span className="hidden sm:inline">Check-in</span>
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} total={count ?? 0} basePath="/services" params={{ tab, type }} />
          </>
        )}
      </Card>
    </>
  );
}
