import Link from "next/link";
import { Download, Plus, UserPlus } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { likeEscape } from "@/features/members/queries";
import { PageHeader } from "@/components/app/page-header";
import { ListToolbar } from "@/components/app/list-toolbar";
import { Pagination, pageRange, parsePage } from "@/components/app/pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VISITOR_STATUSES } from "@/lib/validation";
import { formatDate, titleCase } from "@/lib/format";

export const metadata = { title: "Visitors" };
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function VisitorsPage({ searchParams }: PageProps<"/visitors">) {
  const ctx = await requireChurch("visitors.view", "visitors.create", "visitors.manage");
  const sp = await searchParams;
  const p = { q: str(sp.q), status: str(sp.status), period: str(sp.period), page: parsePage(sp.page) };
  const supabase = await createClient();
  const { from, to } = pageRange(p.page);

  let q = supabase
    .from("visitors")
    .select("id, full_name, phone, visit_date, status, heard_about, services(name)", { count: "exact" })
    .eq("church_id", ctx.church.id);
  if (p.q) q = q.ilike("search_text", `%${likeEscape(p.q.toLowerCase())}%`);
  if (p.status && (VISITOR_STATUSES as readonly string[]).includes(p.status)) q = q.eq("status", p.status);
  if (p.period === "week" || p.period === "month") {
    const d = new Date();
    d.setDate(d.getDate() - (p.period === "week" ? 7 : 30));
    q = q.gte("visit_date", d.toISOString().slice(0, 10));
  }
  const { data, count, error } = await q.order("visit_date", { ascending: false }).order("created_at", { ascending: false }).range(from, to);
  const rows = data ?? [];
  const filtered = Boolean(p.q || p.status || p.period);

  return (
    <>
      <PageHeader
        title="First-time visitors"
        crumbs={[{ label: "People" }, { label: "Visitors" }]}
        actions={
          <>
            {ctx.can("data.export") && (
              <Button asChild variant="outline" size="sm">
                <a href="/api/export/visitors">
                  <Download /> Export CSV
                </a>
              </Button>
            )}
            {ctx.can("visitors.create", "visitors.manage") && (
              <Button asChild size="sm">
                <Link href="/visitors/new">
                  <Plus /> Register visitor
                </Link>
              </Button>
            )}
          </>
        }
      />
      <Card className="overflow-hidden">
        <ListToolbar
          placeholder="Search name, phone or email"
          filters={[
            { name: "status", label: "Status", options: VISITOR_STATUSES.map((s) => ({ value: s, label: s === "unreachable" ? "Unable to reach" : titleCase(s) })) },
            { name: "period", label: "Period", allLabel: "Any time", options: [{ value: "week", label: "Last 7 days" }, { value: "month", label: "Last 30 days" }] },
          ]}
        />
        {error ? (
          <EmptyState title="Couldn't load visitors" description="Please refresh the page." />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title={filtered ? "No visitors match" : "No visitors yet"}
            description={filtered ? "Try clearing the filters." : "Register first-time visitors during or right after a service."}
            action={
              !filtered && ctx.can("visitors.create", "visitors.manage") ? (
                <Button asChild>
                  <Link href="/visitors/new">Register visitor</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Visited</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Heard via</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <Link href={`/visitors/${v.id}`} className="font-medium hover:text-primary">
                          {v.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">{v.phone ?? "—"}</TableCell>
                      <TableCell>{formatDate(v.visit_date)}</TableCell>
                      <TableCell className="text-muted-foreground">{v.services?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{v.heard_about ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={v.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y md:hidden">
              {rows.map((v) => (
                <li key={v.id}>
                  <Link href={`/visitors/${v.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{v.full_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(v.visit_date)}
                        {v.phone ? ` · ${v.phone}` : ""}
                      </span>
                    </span>
                    <StatusBadge status={v.status} />
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={p.page} total={count ?? 0} basePath="/visitors" params={{ ...p, page: undefined }} />
          </>
        )}
      </Card>
    </>
  );
}
