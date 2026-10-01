import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Pagination, pageRange, parsePage } from "@/components/app/pagination";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, titleCase } from "@/lib/format";

export const metadata = { title: "Audit log" };

const ENTITIES = ["member", "visitor", "contribution", "church_user", "church", "church_settings", "giving_category", "department", "service_type", "attendance"];

function summary(meta: Record<string, unknown>) {
  const parts: string[] = [];
  if (meta.name) parts.push(String(meta.name));
  if (meta.membership_number) parts.push(String(meta.membership_number));
  if (meta.email) parts.push(String(meta.email));
  if (meta.role_from) parts.push(`${titleCase(String(meta.role_from))} → ${titleCase(String(meta.role))}`);
  else if (meta.role) parts.push(titleCase(String(meta.role)));
  if (meta.status_from) parts.push(`${titleCase(String(meta.status_from))} → ${titleCase(String(meta.status_to ?? meta.status))}`);
  if (meta.amount) parts.push(`${meta.currency ?? ""} ${meta.amount}${meta.amount_before && meta.amount_before !== meta.amount ? ` (was ${meta.amount_before})` : ""}`);
  if (Array.isArray(meta.changed)) parts.push(`changed: ${(meta.changed as string[]).map((c) => c.replace(/_/g, " ")).join(", ")}`);
  return parts.join(" · ");
}

export default async function AuditPage({ searchParams }: PageProps<"/settings/audit">) {
  const ctx = await requireChurch("audit.view");
  const sp = await searchParams;
  const entity = typeof sp.entity === "string" && ENTITIES.includes(sp.entity) ? sp.entity : undefined;
  const page = parsePage(sp.page);
  const supabase = await createClient();
  const { from, to } = pageRange(page, 50);
  let q = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at, profiles(full_name, email)", { count: "exact" })
    .eq("church_id", ctx.church.id);
  if (entity) q = q.eq("entity_type", entity);
  const { data, count } = await q.order("created_at", { ascending: false }).range(from, to);
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Audit log</CardTitle>
          <CardDescription className="mt-1">Read-only record of sensitive changes. Personal values are not stored — only which fields changed.</CardDescription>
        </div>
        <form action="/settings/audit" className="flex gap-2">
          <select name="entity" defaultValue={entity ?? ""} className="h-9 rounded-md border bg-card px-2 text-sm" aria-label="Filter by record type">
            <option value="">All records</option>
            {ENTITIES.map((e) => (
              <option key={e} value={e}>
                {titleCase(e)}
              </option>
            ))}
          </select>
          <button className="h-9 rounded-md border px-3 text-sm" type="submit">
            Filter
          </button>
        </form>
      </CardHeader>
      {(data ?? []).length === 0 ? (
        <EmptyState title="No audit entries" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.created_at)}</TableCell>
                  <TableCell>{a.profiles?.full_name ?? a.profiles?.email ?? "System"}</TableCell>
                  <TableCell>
                    <Badge variant={a.action.endsWith("archived") || a.action.endsWith("voided") ? "red" : a.action.endsWith("created") || a.action === "user.invited" ? "green" : "blue"}>
                      {titleCase(a.action.replace(".", " "))}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md text-sm text-muted-foreground">{summary((a.metadata ?? {}) as Record<string, unknown>)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} total={count ?? 0} size={50} basePath="/settings/audit" params={{ entity }} />
        </>
      )}
    </Card>
  );
}
