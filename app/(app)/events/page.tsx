import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { EventDialog } from "@/features/events/event-dialog";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate, todayIn } from "@/lib/format";

export const metadata = { title: "Events" };

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const ctx = await requireChurch("events.view", "events.manage", "events.checkin");
  const sp = await searchParams;
  const tab = sp.tab === "past" ? "past" : "upcoming";
  const today = todayIn(ctx.church.timezone);
  const supabase = await createClient();
  let q = supabase.from("events").select("id, name, start_date, end_date, venue, capacity, status, registration_status").eq("church_id", ctx.church.id);
  q = tab === "upcoming" ? q.gte("end_date", today).order("start_date") : q.lt("end_date", today).order("start_date", { ascending: false });
  const { data, error } = await q.limit(60);

  return (
    <>
      <PageHeader title="Events" crumbs={[{ label: "Church" }, { label: "Events" }]} actions={ctx.can("events.manage") ? <EventDialog today={today} /> : undefined} />
      <nav className="mb-3 flex gap-1 border-b" aria-label="Event period">
        {(["upcoming", "past"] as const).map((t) => (
          <Link
            key={t}
            href={`/events?tab=${t}`}
            aria-current={tab === t ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize", tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
          >
            {t}
          </Link>
        ))}
      </nav>
      {error ? (
        <Card>
          <EmptyState title="Couldn't load events" />
        </Card>
      ) : (data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon={CalendarDays} title={tab === "upcoming" ? "No upcoming events" : "No past events"} description="Conferences, retreats, trainings and workers' meetings live here." />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data!.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <Card className="h-full flex-row gap-4 p-4 transition-shadow hover:shadow-md">
                  <span className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-accent py-2 text-accent-foreground">
                    <span className="text-xs font-semibold uppercase">{formatDate(e.start_date, "MMM")}</span>
                    <span className="text-2xl leading-none font-bold">{formatDate(e.start_date, "d")}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{e.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.start_date === e.end_date ? formatDate(e.start_date) : `${formatDate(e.start_date, "d MMM")} – ${formatDate(e.end_date)}`}
                    </p>
                    {e.venue && (
                      <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3" aria-hidden /> {e.venue}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge status={e.status} />
                      {e.status === "scheduled" && <StatusBadge status={e.registration_status} />}
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
