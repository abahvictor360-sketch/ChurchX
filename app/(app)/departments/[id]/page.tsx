import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { AddDepartmentMember, DepartmentDialog } from "@/features/departments/department-dialog";
import { LeaveDepartmentButton } from "@/features/departments/leave-button";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Department" };

export default async function DepartmentPage({ params }: PageProps<"/departments/[id]">) {
  const ctx = await requireChurch();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("departments")
    .select(
      "id, name, description, status, leader_member_id, assistant_member_id, leader:members!departments_leader_fk(id, full_name, membership_number), assistant:members!departments_assistant_fk(id, full_name, membership_number)",
    )
    .eq("id", id)
    .eq("church_id", ctx.church.id)
    .maybeSingle();
  if (!d) notFound();
  const { data: rows } = await supabase
    .from("department_members")
    .select("id, joined_on, left_on, member_id, members(id, full_name, phone, membership_status)")
    .eq("department_id", id)
    .order("left_on", { ascending: true, nullsFirst: true })
    .order("joined_on", { ascending: false });
  const active = (rows ?? []).filter((r) => !r.left_on);
  const former = (rows ?? []).filter((r) => r.left_on);
  const canManage = ctx.can("departments.manage");
  const opt = (m: { id: string; full_name: string; membership_number: string | null } | null) =>
    m ? { id: m.id, kind: "member" as const, name: m.full_name, detail: m.membership_number } : null;

  return (
    <>
      <PageHeader
        title={d.name}
        description={d.description ?? undefined}
        crumbs={[{ label: "Departments", href: "/departments" }, { label: d.name }]}
        actions={
          canManage ? (
            <DepartmentDialog department={{ id: d.id, name: d.name, description: d.description, status: d.status, leader: opt(d.leader), assistant: opt(d.assistant) }} />
          ) : undefined
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Status</p>
          <StatusBadge status={d.status} className="mt-1" />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Active members</p>
          <p className="text-2xl font-bold tabular-nums">{active.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Leader</p>
          <p className="font-medium">{d.leader?.full_name ?? "Not set"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Assistant</p>
          <p className="font-medium">{d.assistant?.full_name ?? "Not set"}</p>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {canManage && <AddDepartmentMember departmentId={d.id} />}
          {active.length === 0 ? (
            <EmptyState title="No members yet" className="py-6" />
          ) : (
            <ul className="divide-y rounded-md border">
              {active.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/members/${r.member_id}`} className="font-medium hover:text-primary">
                      {r.members?.full_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Since {formatDate(r.joined_on)}
                      {r.members?.phone ? ` · ${r.members.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.member_id === d.leader_member_id && <Badge variant="orange">Leader</Badge>}
                    {r.member_id === d.assistant_member_id && <Badge variant="teal">Assistant</Badge>}
                    {canManage && <LeaveDepartmentButton id={r.id} name={r.members?.full_name ?? "member"} department={d.name} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {former.length > 0 && (
            <details className="rounded-md border px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">Former members ({former.length})</summary>
              <ul className="mt-3 grid gap-2 text-sm">
                {former.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span>{r.members?.full_name}</span>
                    <span className="text-muted-foreground">
                      {formatDate(r.joined_on)} – {formatDate(r.left_on)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>
    </>
  );
}
