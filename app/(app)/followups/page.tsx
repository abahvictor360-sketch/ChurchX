import Link from "next/link";
import { CalendarClock, MessageCircle, Phone, PhoneCall, MessageSquare } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { listWorkers } from "@/features/members/queries";
import { RecordFollowupDialog } from "@/features/followups/record-dialog";
import { FollowupManageMenu } from "@/features/followups/manage-menu";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Pagination, pageRange, parsePage } from "@/components/app/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, titleCase, todayIn } from "@/lib/format";
import { smsLink, telLink, whatsappLink } from "@/lib/phone";

export const metadata = { title: "Follow-ups" };

const VIEWS = [
  { key: "mine", label: "My follow-ups" },
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
] as const;

export default async function FollowupsPage({ searchParams }: PageProps<"/followups">) {
  const ctx = await requireChurch();
  const sp = await searchParams;
  const viewAll = ctx.can("followups.view_all");
  const view = VIEWS.some((v) => v.key === sp.view) ? (sp.view as string) : "mine";
  const worker = typeof sp.worker === "string" && viewAll ? sp.worker : view === "mine" ? ctx.userId : undefined;
  const page = parsePage(sp.page);
  const today = todayIn(ctx.church.timezone);
  const supabase = await createClient();
  const { from, to } = pageRange(page);

  let q = supabase
    .from("followups")
    .select(
      "id, due_date, status, notes, contact_method, outcome, completed_at, assigned_to, member_id, visitor_id, members(id, full_name, phone, first_name), visitors(id, full_name, phone, first_name, status), profiles!followups_assignee_profile_fk(full_name)",
      { count: "exact" },
    )
    .eq("church_id", ctx.church.id);
  // Without view_all, RLS already limits rows to the user's own assignments.
  if (worker) q = q.eq("assigned_to", worker);
  if (view === "completed") q = q.eq("status", "completed").order("completed_at", { ascending: false });
  else {
    q = q.eq("status", "pending");
    if (view === "today") q = q.eq("due_date", today);
    if (view === "overdue") q = q.lt("due_date", today);
    if (view === "upcoming") q = q.gt("due_date", today);
    q = q.order("due_date", { ascending: true });
  }
  const [{ data, count, error }, workers] = await Promise.all([q.range(from, to), viewAll ? listWorkers(supabase, ctx.church.id) : Promise.resolve([])]);
  const rows = data ?? [];

  const tabHref = (key: string) => {
    const p = new URLSearchParams({ view: key });
    if (typeof sp.worker === "string") p.set("worker", sp.worker);
    return `/followups?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description={viewAll ? "Track every visitor and member being followed up." : "People assigned to you for follow-up."}
        crumbs={[{ label: "People" }, { label: "Follow-ups" }]}
      />
      <nav aria-label="Follow-up views" className="mb-3 flex gap-1 overflow-x-auto border-b [scrollbar-width:none]">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={tabHref(v.key)}
            aria-current={view === v.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap",
              view === v.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      {viewAll && view !== "mine" && (
        <form className="mb-3 flex flex-wrap items-center gap-2 text-sm" action="/followups">
          <input type="hidden" name="view" value={view} />
          <label htmlFor="worker" className="text-muted-foreground">
            Worker
          </label>
          <select id="worker" name="worker" defaultValue={typeof sp.worker === "string" ? sp.worker : ""} className="h-9 rounded-md border bg-card px-2">
            <option value="">Everyone</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="outline">
            Apply
          </Button>
        </form>
      )}

      {error ? (
        <Card>
          <EmptyState title="Couldn't load follow-ups" description="Please refresh the page." />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={PhoneCall}
            title={view === "overdue" ? "Nothing overdue 🎉" : view === "completed" ? "No completed follow-ups yet" : "No follow-ups here"}
            description={view === "mine" ? "When someone is assigned to you, they'll appear here with quick call and WhatsApp buttons." : undefined}
          />
        </Card>
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((f) => {
              const person = f.members ?? f.visitors;
              const isVisitor = !f.members && Boolean(f.visitors);
              const href = f.members ? `/members/${f.members.id}` : f.visitors ? `/visitors/${f.visitors.id}` : "#";
              const overdue = f.status === "pending" && f.due_date < today;
              const phone = person?.phone ?? null;
              const wa = whatsappLink(phone, `Hello ${person?.first_name ?? ""}, `);
              return (
                <li key={f.id}>
                  <Card className={cn("h-full gap-3 p-4", overdue && "border-destructive/40")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={href} className="block truncate font-semibold hover:text-primary">
                          {person?.full_name ?? "Unknown person"}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {isVisitor ? "Visitor" : "Member"}
                          {viewAll && ` · ${f.profiles?.full_name ?? "—"}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <StatusBadge status={overdue ? "overdue" : f.status} />
                        {ctx.can("followups.manage") && f.status === "pending" && (
                          <FollowupManageMenu id={f.id} workers={workers} today={today} currentAssignee={f.assigned_to} />
                        )}
                      </div>
                    </div>
                    <p className="flex items-center gap-1.5 text-sm">
                      <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                      {f.status === "completed" ? `Completed ${formatDateTime(f.completed_at)}` : `Due ${f.due_date === today ? "today" : formatDate(f.due_date)}`}
                    </p>
                    {f.status === "completed" && (
                      <p className="text-sm text-muted-foreground">
                        {titleCase(f.contact_method)} · {titleCase(f.outcome)}
                      </p>
                    )}
                    {f.notes && <p className="line-clamp-3 rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-wrap">{f.notes}</p>}
                    {f.status === "pending" && (
                      <div className="mt-auto flex flex-wrap gap-2 pt-1">
                        {phone ? (
                          <>
                            <Button asChild variant="outline" size="sm" className="h-10 sm:h-8">
                              <a href={telLink(phone)!} aria-label={`Call ${person?.full_name}`}>
                                <Phone /> Call
                              </a>
                            </Button>
                            {wa && (
                              <Button asChild variant="outline" size="sm" className="h-10 sm:h-8">
                                <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${person?.full_name}`}>
                                  <MessageCircle /> WhatsApp
                                </a>
                              </Button>
                            )}
                            <Button asChild variant="ghost" size="sm" className="h-10 sm:h-8">
                              <a href={smsLink(phone)!} aria-label={`Text ${person?.full_name}`}>
                                <MessageSquare /> SMS
                              </a>
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">No phone number recorded</span>
                        )}
                        {(f.assigned_to === ctx.userId || ctx.can("followups.manage")) && (
                          <RecordFollowupDialog followupId={f.id} personName={person?.full_name ?? "this person"} isVisitor={isVisitor} today={today} />
                        )}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
          <Card className="mt-3">
            <Pagination page={page} total={count ?? 0} basePath="/followups" params={{ view, worker: typeof sp.worker === "string" ? sp.worker : undefined }} />
          </Card>
        </>
      )}
    </>
  );
}
