import Link from "next/link";
import { UsersRound } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { DepartmentDialog } from "@/features/departments/department-dialog";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const ctx = await requireChurch();
  const supabase = await createClient();
  // RLS returns all departments for departments.view/manage, otherwise only those the user leads.
  const { data, error } = await supabase
    .from("departments")
    .select("id, name, description, status, leader:members!departments_leader_fk(full_name), department_members(id, left_on)")
    .eq("church_id", ctx.church.id)
    .order("status")
    .order("name");
  const canManage = ctx.can("departments.manage");
  const scoped = !ctx.can("departments.view", "departments.manage");

  return (
    <>
      <PageHeader
        title="Departments"
        description={scoped ? "Departments you lead." : undefined}
        crumbs={[{ label: "Church" }, { label: "Departments" }]}
        actions={canManage ? <DepartmentDialog /> : undefined}
      />
      {error ? (
        <Card>
          <EmptyState title="Couldn't load departments" />
        </Card>
      ) : (data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon={UsersRound}
            title={scoped ? "You don't lead any departments" : "No departments yet"}
            description={scoped ? "Ask an administrator to link your account to your member record and set you as a department leader." : "Create departments such as Choir, Ushers, Media, Children and Prayer."}
            action={canManage ? <DepartmentDialog /> : undefined}
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data!.map((d) => {
            const active = d.department_members.filter((m) => !m.left_on).length;
            return (
              <li key={d.id}>
                <Link href={`/departments/${d.id}`} className="block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <Card className="h-full gap-3 p-5 transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <UsersRound className="size-5" aria-hidden />
                      </span>
                      <StatusBadge status={d.status} />
                    </div>
                    <div>
                      <p className="font-semibold">{d.name}</p>
                      {d.description && <p className="line-clamp-2 text-sm text-muted-foreground">{d.description}</p>}
                    </div>
                    <div className="mt-auto flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Leader: {d.leader?.full_name ?? "Not set"}</span>
                      <span className="font-semibold tabular-nums">
                        {active} member{active === 1 ? "" : "s"}
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
