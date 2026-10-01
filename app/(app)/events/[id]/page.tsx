import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Clock, MapPin, Users } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { EventDialog } from "@/features/events/event-dialog";
import { RegisterAttendee, RegistrationRowActions } from "@/features/events/registration";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatTime, todayIn } from "@/lib/format";

export const metadata = { title: "Event" };

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const ctx = await requireChurch("events.view", "events.manage", "events.checkin");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: e } = await supabase.from("events").select("*").eq("id", id).eq("church_id", ctx.church.id).maybeSingle();
  if (!e) notFound();
  const canRegister = ctx.can("events.manage", "events.checkin");
  const { data: regs } = canRegister
    ? await supabase
        .from("event_registrations")
        .select("id, status, attended, checked_in_at, guest_name, guest_phone, member_id, visitor_id, members(full_name), visitors(full_name)")
        .eq("event_id", id)
        .order("created_at", { ascending: false })
    : { data: null };
  const active = (regs ?? []).filter((r) => r.status === "registered");
  const attended = active.filter((r) => r.attended).length;
  const full = e.capacity !== null && active.length >= e.capacity;
  const disabledReason =
    e.status === "cancelled" ? "This event was cancelled." : e.registration_status === "closed" ? "Registration is closed." : full ? `This event is full (${e.capacity} places).` : null;

  return (
    <>
      <PageHeader
        title={e.name}
        crumbs={[{ label: "Events", href: "/events" }, { label: e.name }]}
        actions={ctx.can("events.manage") ? <EventDialog event={e} today={todayIn(ctx.church.timezone)} /> : undefined}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge status={e.status} />
              <StatusBadge status={e.registration_status} />
            </div>
            <p className="font-medium">{e.start_date === e.end_date ? formatDate(e.start_date, "EEEE d MMMM yyyy") : `${formatDate(e.start_date, "d MMM")} – ${formatDate(e.end_date, "d MMM yyyy")}`}</p>
            <p className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" aria-hidden />
              {e.start_time ? `${formatTime(e.start_time)}${e.end_time ? ` – ${formatTime(e.end_time)}` : ""}` : "Time not set"}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" aria-hidden />
              {e.venue ?? "Venue not set"}
            </p>
            {e.description && <p className="whitespace-pre-wrap text-muted-foreground">{e.description}</p>}
            {canRegister && (
              <div className="mt-2 grid gap-2 rounded-lg border p-3">
                <p className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-4 text-muted-foreground" aria-hidden /> Registered
                  </span>
                  <strong className="tabular-nums">
                    {active.length}
                    {e.capacity ? ` / ${e.capacity}` : ""}
                  </strong>
                </p>
                {e.capacity && <Progress value={(active.length / e.capacity) * 100} label="Capacity used" />}
                <p className="flex items-center justify-between">
                  <span>Checked in</span>
                  <strong className="tabular-nums">{attended}</strong>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        {canRegister ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Attendees</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <RegisterAttendee eventId={e.id} disabledReason={disabledReason} />
              {(regs ?? []).length === 0 ? (
                <EmptyState title="No registrations yet" className="py-6" />
              ) : (
                <ul className="divide-y rounded-md border">
                  {regs!.map((r) => {
                    const name = r.members?.full_name ?? r.visitors?.full_name ?? r.guest_name ?? "Guest";
                    const href = r.member_id ? `/members/${r.member_id}` : r.visitor_id ? `/visitors/${r.visitor_id}` : null;
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          {href ? (
                            <Link href={href} className="font-medium hover:text-primary">
                              {name}
                            </Link>
                          ) : (
                            <span className="font-medium">{name}</span>
                          )}
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <Badge variant="muted">{r.member_id ? "Member" : r.visitor_id ? "Visitor" : "Guest"}</Badge>
                            {r.status === "cancelled" ? <StatusBadge status="cancelled" /> : r.attended ? <StatusBadge status="present" /> : null}
                          </div>
                        </div>
                        <RegistrationRowActions id={r.id} attended={r.attended} cancelled={r.status === "cancelled"} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
