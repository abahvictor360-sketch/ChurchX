import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Cake, CalendarCheck, Clock, Lock, Mail, MapPin, Percent, Phone, UserPlus, UsersRound } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { listDepartmentsBrief, listWorkers, signedPhotoUrl } from "@/features/members/queries";
import { MemberPhoto } from "@/features/members/photo-uploader";
import { MemberProfileActions } from "@/features/members/profile-actions";
import { NoteForm } from "@/features/members/note-form";
import { LeaveDepartmentButton } from "@/features/departments/leave-button";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { age, formatDate, formatDateTime, formatMoney, titleCase, todayIn } from "@/lib/format";
import { telLink, whatsappLink } from "@/lib/phone";

export const metadata = { title: "Member profile" };

type Overview = {
  attendance_pct: number | null;
  last_attendance: string | null;
  membership_days: number;
  next_birthday: string | null;
  services_attended: number;
  services_considered: number;
};

function duration(days: number) {
  if (days < 31) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"}${months % 12 ? ` ${months % 12} mo` : ""}`;
}

export default async function MemberProfilePage({ params, searchParams }: PageProps<"/members/[id]">) {
  const ctx = await requireChurch();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();

  // RLS decides visibility: directory roles, department leaders, assigned follow-up workers.
  const { data: m } = await supabase.from("members").select("*").eq("id", id).eq("church_id", ctx.church.id).maybeSingle();
  if (!m) notFound();

  const canGiving = ctx.can("giving.view");
  const [overview, attendance, departments, followups, events, notes, giving, visitor, photoUrl, workers, deptOptions] = await Promise.all([
    supabase.rpc("member_overview", { p_member: id }),
    supabase
      .from("attendance")
      .select("id, status, checked_in_at, services(id, name, service_date)")
      .eq("member_id", id)
      .order("checked_in_at", { ascending: false })
      .limit(25),
    supabase.from("department_members").select("id, joined_on, left_on, departments(id, name)").eq("member_id", id).order("joined_on", { ascending: false }),
    supabase
      .from("followups")
      .select("id, due_date, status, contact_method, outcome, notes, completed_at, profiles!followups_assignee_profile_fk(full_name)")
      .eq("member_id", id)
      .order("due_date", { ascending: false })
      .limit(25),
    supabase.from("event_registrations").select("id, attended, status, events(id, name, start_date)").eq("member_id", id).order("created_at", { ascending: false }).limit(25),
    supabase.from("member_notes").select("id, body, visibility, created_at, profiles(full_name)").eq("member_id", id).order("created_at", { ascending: false }).limit(50),
    canGiving
      ? supabase
          .from("contributions")
          .select("id, amount, contribution_date, payment_method, status, giving_categories(name)")
          .eq("member_id", id)
          .eq("status", "recorded")
          .order("contribution_date", { ascending: false })
          .limit(50)
      : null,
    supabase.from("visitors").select("id, visit_date").eq("converted_member_id", id).maybeSingle(),
    signedPhotoUrl(supabase, m.photo_path),
    ctx.can("followups.manage") ? listWorkers(supabase, ctx.church.id) : Promise.resolve([]),
    ctx.can("departments.manage") ? listDepartmentsBrief(supabase, ctx.church.id) : Promise.resolve([]),
  ]);

  const ov = (overview.data ?? null) as Overview | null;
  const activeDepts = (departments.data ?? []).filter((d) => !d.left_on);
  const lastFollowup = (followups.data ?? []).find((f) => f.status === "completed");
  const today = todayIn(ctx.church.timezone);
  const memberAge = age(m.date_of_birth);
  const givingTotal = (giving?.data ?? []).reduce((s, c) => s + Number(c.amount), 0);

  return (
    <>
      <PageHeader title="Member profile" crumbs={[{ label: "Members", href: "/members" }, { label: m.full_name }]} />
      {(sp.created || sp.saved) && (
        <p role="status" className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          {sp.created ? "Member added successfully." : "Changes saved."}
        </p>
      )}

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <MemberPhoto churchId={ctx.church.id} memberId={m.id} name={m.full_name} url={photoUrl} editable={ctx.can("members.manage")} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{m.full_name}</h2>
              <StatusBadge status={m.membership_status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[m.membership_number, m.gender && titleCase(m.gender), memberAge !== null ? `${memberAge} yrs` : null, m.occupation].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {m.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5 text-muted-foreground" aria-hidden /> {m.phone}
                </span>
              )}
              {m.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground" aria-hidden /> {m.email}
                </span>
              )}
              {(m.city || m.state) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground" aria-hidden /> {[m.city, m.state].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
          <MemberProfileActions
            memberId={m.id}
            name={m.full_name}
            status={m.membership_status}
            tel={telLink(m.phone)}
            whatsapp={whatsappLink(m.phone, `Hello ${m.first_name}, `)}
            canManage={ctx.can("members.manage")}
            canAssign={ctx.can("followups.manage")}
            canDepartments={ctx.can("departments.manage")}
            workers={workers}
            departments={deptOptions}
            today={today}
          />
        </CardContent>
      </Card>

      <section aria-label="Summary" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Mini icon={CalendarCheck} label="Last attended" value={ov?.last_attendance ? formatDate(ov.last_attendance) : "No record"} />
        <Mini icon={Percent} label="Attendance (12 mo)" value={ov?.attendance_pct != null ? `${ov.attendance_pct}%` : "—"} detail={ov ? `${ov.services_attended} of ${ov.services_considered} services` : undefined} />
        <Mini icon={Clock} label="Member for" value={ov ? duration(Math.max(0, ov.membership_days)) : "—"} detail={`since ${formatDate(m.join_date)}`} />
        <Mini icon={Cake} label="Next birthday" value={ov?.next_birthday ? formatDate(ov.next_birthday, "d MMM") : "Not recorded"} detail={ov?.next_birthday === today ? "Today! 🎉" : undefined} />
      </section>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          {canGiving && <TabsTrigger value="giving">Giving</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
                <Detail label="Date of birth" value={m.date_of_birth ? formatDate(m.date_of_birth) : null} />
                <Detail label="Marital status" value={m.marital_status ? titleCase(m.marital_status) : null} />
                <Detail label="Address" value={[m.address, m.city, m.state, m.country].filter(Boolean).join(", ") || null} />
                <Detail label="Emergency contact" value={[m.emergency_contact_name, m.emergency_contact_phone].filter(Boolean).join(" · ") || null} />
                <Detail label="Departments" value={activeDepts.map((d) => d.departments?.name).filter(Boolean).join(", ") || null} />
                <Detail label="Joined" value={formatDate(m.join_date)} />
                {visitor.data && <Detail label="First visit" value={`${formatDate(visitor.data.visit_date)} (converted from visitor)`} />}
              </dl>
              {m.notes && <p className="mt-4 rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{m.notes}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent follow-up</CardTitle>
            </CardHeader>
            <CardContent>
              {lastFollowup ? (
                <div className="text-sm">
                  <p className="font-medium">
                    {titleCase(lastFollowup.contact_method)} · {titleCase(lastFollowup.outcome)}
                  </p>
                  <p className="text-muted-foreground">
                    {formatDateTime(lastFollowup.completed_at)} by {lastFollowup.profiles?.full_name ?? "a worker"}
                  </p>
                  {lastFollowup.notes && <p className="mt-2 whitespace-pre-wrap">{lastFollowup.notes}</p>}
                </div>
              ) : (
                <EmptyState icon={UserPlus} title="No follow-up recorded" className="py-6" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card className="overflow-hidden">
            {(attendance.data ?? []).length === 0 ? (
              <EmptyState title="No attendance recorded" description="Check-ins for this member will appear here." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.data!.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.services?.name}</TableCell>
                      <TableCell>{formatDate(a.services?.service_date)}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="departments">
          <Card className="overflow-hidden">
            {(departments.data ?? []).length === 0 ? (
              <EmptyState icon={UsersRound} title="Not in any department" description="Use “Add to department” above to involve this member." />
            ) : (
              <ul className="divide-y">
                {departments.data!.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <Link href={`/departments/${d.departments?.id}`} className="font-medium hover:text-primary">
                        {d.departments?.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Joined {formatDate(d.joined_on)}
                        {d.left_on && ` · Left ${formatDate(d.left_on)}`}
                      </p>
                    </div>
                    {d.left_on ? (
                      <Badge variant="gray">Former</Badge>
                    ) : ctx.can("departments.manage") ? (
                      <LeaveDepartmentButton id={d.id} name={m.full_name} department={d.departments?.name ?? "department"} />
                    ) : (
                      <Badge variant="green">Active</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="followups">
          <Card className="overflow-hidden">
            {(followups.data ?? []).length === 0 ? (
              <EmptyState title="No follow-ups" />
            ) : (
              <ul className="divide-y">
                {followups.data!.map((f) => (
                  <li key={f.id} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={f.status === "pending" && f.due_date < today ? "overdue" : f.status} />
                      <span className="font-medium">Due {formatDate(f.due_date)}</span>
                      <span className="text-muted-foreground">· {f.profiles?.full_name ?? "Unassigned"}</span>
                    </div>
                    {f.status === "completed" && (
                      <p className="mt-1 text-muted-foreground">
                        {titleCase(f.contact_method)} · {titleCase(f.outcome)}
                      </p>
                    )}
                    {f.notes && <p className="mt-1 whitespace-pre-wrap">{f.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card className="overflow-hidden">
            {(events.data ?? []).length === 0 ? (
              <EmptyState title="No event registrations" />
            ) : (
              <ul className="divide-y">
                {events.data!.map((e) => (
                  <li key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <Link href={`/events/${e.events?.id}`} className="font-medium hover:text-primary">
                      {e.events?.name}
                      <span className="ml-2 font-normal text-muted-foreground">{formatDate(e.events?.start_date)}</span>
                    </Link>
                    <StatusBadge status={e.status === "cancelled" ? "cancelled" : e.attended ? "present" : "registered"} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="grid gap-4">
          {ctx.can("members.notes", "members.manage") && (
            <Card>
              <CardContent>
                <NoteForm memberId={m.id} canConfidential={ctx.can("members.view_sensitive")} />
              </CardContent>
            </Card>
          )}
          <Card className="overflow-hidden">
            {(notes.data ?? []).length === 0 ? (
              <EmptyState title="No notes yet" />
            ) : (
              <ul className="divide-y">
                {notes.data!.map((n) => (
                  <li key={n.id} className="px-5 py-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {n.visibility === "confidential" && (
                        <Badge variant="red">
                          <Lock /> Confidential
                        </Badge>
                      )}
                      {n.profiles?.full_name ?? "Staff"} · {formatDateTime(n.created_at)}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        {canGiving && (
          <TabsContent value="giving">
            <Card className="overflow-hidden">
              {(giving?.data ?? []).length === 0 ? (
                <EmptyState title="No contributions recorded" />
              ) : (
                <>
                  <div className="border-b px-5 py-3 text-sm">
                    Recent total: <strong>{formatMoney(givingTotal, ctx.church.currency)}</strong>{" "}
                    <span className="text-muted-foreground">({giving!.data!.length} records)</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {giving!.data!.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{formatDate(c.contribution_date)}</TableCell>
                          <TableCell>{c.giving_categories?.name}</TableCell>
                          <TableCell>{titleCase(c.payment_method)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(c.amount, ctx.church.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

function Mini({ icon: Icon, label, value, detail }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; detail?: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 text-primary" aria-hidden /> {label}
      </p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value ?? <span className="text-muted-foreground">—</span>}</dd>
    </>
  );
}
