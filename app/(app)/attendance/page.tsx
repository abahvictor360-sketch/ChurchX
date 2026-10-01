import Link from "next/link";
import { CalendarDays, ChevronRight, ClipboardCheck } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, formatDate, formatTime, todayIn } from "@/lib/format";

export const metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const ctx = await requireChurch("attendance.record", "attendance.view");
  const today = todayIn(ctx.church.timezone);
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("id, name, service_date, start_time, status, location")
    .eq("church_id", ctx.church.id)
    .neq("status", "cancelled")
    .gte("service_date", addDays(today, -21))
    .lte("service_date", addDays(today, 7))
    .order("service_date", { ascending: false })
    .order("start_time", { ascending: true });
  const services = data ?? [];
  const todays = services.filter((s) => s.service_date === today);
  const recent = services.filter((s) => s.service_date < today);
  const upcoming = services.filter((s) => s.service_date > today).reverse();

  return (
    <>
      <PageHeader title="Attendance" description="Choose a service to check people in." crumbs={[{ label: "Church" }, { label: "Attendance" }]} />
      <section aria-labelledby="today-h" className="mb-6">
        <h2 id="today-h" className="mb-2 text-sm font-semibold text-muted-foreground uppercase">
          Today · {formatDate(today, "EEEE d MMM")}
        </h2>
        {todays.length === 0 ? (
          <Card>
            <EmptyState
              icon={CalendarDays}
              title="No service scheduled today"
              description={ctx.can("services.manage") ? "Schedule today's service to start check-in." : "Ask an administrator to schedule today's service."}
              action={
                ctx.can("services.manage") ? (
                  <Button asChild>
                    <Link href="/services?new=1">Schedule a service</Link>
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todays.map((s) => (
              <Link key={s.id} href={`/attendance/${s.id}`} className="group rounded-xl border-2 border-primary/30 bg-card p-5 shadow-sm transition hover:border-primary hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <ClipboardCheck className="size-5" aria-hidden />
                  </span>
                  <StatusBadge status={s.status} />
                </div>
                <p className="mt-3 text-lg font-semibold">{s.name}</p>
                <p className="text-sm text-muted-foreground">
                  {s.start_time ? formatTime(s.start_time) : "Time not set"}
                  {s.location ? ` · ${s.location}` : ""}
                </p>
                <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary">
                  Start check-in <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { title: "Recent services", items: recent },
          { title: "Coming up", items: upcoming },
        ].map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {group.items.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="divide-y border-t">
                  {group.items.map((s) => (
                    <li key={s.id}>
                      <Link href={`/attendance/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted">
                        <span>
                          <span className="block text-sm font-medium">{s.name}</span>
                          <span className="block text-xs text-muted-foreground">{formatDate(s.service_date, "EEE d MMM")}</span>
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
