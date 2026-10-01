import Link from "next/link";
import { Download, Plus, Upload, Users } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { listDepartmentsBrief, listMembers, listWorkers } from "@/features/members/queries";
import { MembersTable } from "@/features/members/members-table";
import { PageHeader } from "@/components/app/page-header";
import { ListToolbar } from "@/components/app/list-toolbar";
import { Pagination, parsePage } from "@/components/app/pagination";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MEMBER_STATUSES } from "@/lib/validation";
import { titleCase, todayIn } from "@/lib/format";

export const metadata = { title: "Members" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function MembersPage({ searchParams }: PageProps<"/members">) {
  const ctx = await requireChurch("members.view", "members.manage");
  const sp = await searchParams;
  const params = { q: str(sp.q), status: str(sp.status), department: str(sp.department), gender: str(sp.gender), sort: str(sp.sort), page: parsePage(sp.page) };
  const supabase = await createClient();
  const [{ rows, total, error }, departments, workers] = await Promise.all([
    listMembers(supabase, ctx.church.id, params),
    listDepartmentsBrief(supabase, ctx.church.id),
    ctx.can("followups.manage") ? listWorkers(supabase, ctx.church.id) : Promise.resolve([]),
  ]);
  const filtered = Boolean(params.q || params.status || params.department || params.gender);
  const exportQs = new URLSearchParams(Object.entries({ q: params.q, status: params.status, department: params.department, gender: params.gender }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Members"
        crumbs={[{ label: "People" }, { label: "Members" }]}
        actions={
          <>
            {ctx.can("data.export") && (
              <Button asChild variant="outline" size="sm">
                <a href={`/api/export/members${exportQs ? `?${exportQs}` : ""}`}>
                  <Download /> Export CSV
                </a>
              </Button>
            )}
            {ctx.can("data.import") && (
              <Button asChild variant="outline" size="sm">
                <Link href="/members/import">
                  <Upload /> Import
                </Link>
              </Button>
            )}
            {ctx.can("members.manage") && (
              <Button asChild size="sm">
                <Link href="/members/new">
                  <Plus /> Add member
                </Link>
              </Button>
            )}
          </>
        }
      />
      <Card className="overflow-hidden">
        <ListToolbar
          placeholder="Search name, phone, email or member no."
          filters={[
            { name: "status", label: "Status", allLabel: "All (except archived)", options: MEMBER_STATUSES.map((s) => ({ value: s, label: titleCase(s) })) },
            { name: "department", label: "Department", allLabel: "All departments", options: departments.map((d) => ({ value: d.id, label: d.name })) },
            { name: "gender", label: "Gender", allLabel: "Any gender", options: [{ value: "male", label: "Male" }, { value: "female", label: "Female" }] },
            { name: "sort", label: "Sort", allLabel: "Sort: name", options: [{ value: "newest", label: "Newest members" }, { value: "oldest", label: "Longest members" }, { value: "number", label: "Member number" }] },
          ]}
        />
        {error ? (
          <EmptyState title="Couldn't load members" description="Please refresh the page. If the problem continues, contact your administrator." />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filtered ? "No members match your search" : "No members yet"}
            description={filtered ? "Try a different name or clear the filters." : "Add your first member, import a CSV, or convert visitors into members."}
            action={
              !filtered && ctx.can("members.manage") ? (
                <Button asChild>
                  <Link href="/members/new">
                    <Plus /> Add member
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <MembersTable
              rows={rows}
              canManage={ctx.can("members.manage")}
              canAssign={ctx.can("followups.manage")}
              canDepartments={ctx.can("departments.manage")}
              departments={departments}
              workers={workers}
              today={todayIn(ctx.church.timezone)}
            />
            <Pagination page={params.page} total={total} basePath="/members" params={{ ...params, page: undefined }} />
          </>
        )}
      </Card>
    </>
  );
}
