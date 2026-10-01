import Link from "next/link";
import { Download, HandCoins, Plus } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { StatCard } from "@/components/app/stat-card";
import { Pagination, pageRange, parsePage } from "@/components/app/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYMENT_METHODS } from "@/lib/validation";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import { CalendarDays, CalendarRange, TrendingUp } from "lucide-react";

export const metadata = { title: "Contributions" };
const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function GivingPage({ searchParams }: PageProps<"/giving">) {
  const ctx = await requireChurch("giving.view", "giving.manage");
  const sp = await searchParams;
  const f = { from: isDate(str(sp.from)), to: isDate(str(sp.to)), category: str(sp.category), method: str(sp.method), status: str(sp.status) ?? "recorded" };
  const page = parsePage(sp.page);
  const supabase = await createClient();
  const { from, to } = pageRange(page);
  const currency = ctx.church.currency;
  const canView = ctx.can("giving.view");

  let q = supabase
    .from("contributions")
    .select("id, amount, contribution_date, payment_method, reference, status, is_anonymous, contributor_name, member_id, members(full_name), giving_categories(name)", { count: "exact" })
    .eq("church_id", ctx.church.id);
  if (f.status !== "all") q = q.eq("status", f.status === "voided" ? "voided" : "recorded");
  if (f.from) q = q.gte("contribution_date", f.from);
  if (f.to) q = q.lte("contribution_date", f.to);
  if (f.category) q = q.eq("category_id", f.category);
  if (f.method && (PAYMENT_METHODS as readonly string[]).includes(f.method)) q = q.eq("payment_method", f.method);
  const [{ data, count, error }, { data: categories }, summary] = await Promise.all([
    canView ? q.order("contribution_date", { ascending: false }).order("created_at", { ascending: false }).range(from, to) : Promise.resolve({ data: [], count: 0, error: null }),
    supabase.from("giving_categories").select("id, name").eq("church_id", ctx.church.id).order("sort_order"),
    canView ? supabase.rpc("report_giving_summary", { p_church: ctx.church.id }) : null,
  ]);
  const s = (summary?.data ?? {}) as { today?: number; week?: number; month?: number; prev_month?: number };
  const exportQs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Contributions"
        crumbs={[{ label: "Finance" }, { label: "Contributions" }]}
        actions={
          <>
            {ctx.can("data.export") && canView && (
              <Button asChild variant="outline" size="sm">
                <a download href={`/api/export/contributions?${exportQs}`}>
                  <Download /> Export CSV
                </a>
              </Button>
            )}
            {ctx.can("giving.manage") && (
              <Button asChild size="sm">
                <Link href="/giving/new">
                  <Plus /> Record contribution
                </Link>
              </Button>
            )}
          </>
        }
      />
      {canView && (
        <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Giving summary">
          <StatCard label="Today" value={formatMoney(s.today, currency, true)} icon={HandCoins} />
          <StatCard label="This week" value={formatMoney(s.week, currency, true)} icon={CalendarDays} tone="teal" />
          <StatCard label="This month" value={formatMoney(s.month, currency, true)} icon={CalendarRange} tone="green" />
          <StatCard label="Last month" value={formatMoney(s.prev_month, currency, true)} icon={TrendingUp} />
        </section>
      )}
      <Card className="overflow-hidden">
        <form action="/giving" className="grid gap-2 border-b p-3 sm:grid-cols-6 sm:p-4">
          <label className="grid gap-1 text-xs text-muted-foreground">
            From
            <Input type="date" name="from" defaultValue={f.from} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            To
            <Input type="date" name="to" defaultValue={f.to} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Category
            <select name="category" defaultValue={f.category ?? ""} className="h-10 rounded-md border bg-card px-2 text-sm text-foreground sm:h-9">
              <option value="">All</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Method
            <select name="method" defaultValue={f.method ?? ""} className="h-10 rounded-md border bg-card px-2 text-sm text-foreground sm:h-9">
              <option value="">All</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m === "pos" ? "POS" : titleCase(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Status
            <select name="status" defaultValue={f.status} className="h-10 rounded-md border bg-card px-2 text-sm text-foreground sm:h-9">
              <option value="recorded">Recorded</option>
              <option value="voided">Voided</option>
              <option value="all">All</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="outline" className="flex-1">
              Filter
            </Button>
            <Button asChild variant="ghost">
              <Link href="/giving">Reset</Link>
            </Button>
          </div>
        </form>
        {!canView ? (
          <EmptyState icon={HandCoins} title="Record contributions" description="You can record new contributions. Viewing giving history requires finance access." />
        ) : error ? (
          <EmptyState title="Couldn't load contributions" />
        ) : (data ?? []).length === 0 ? (
          <EmptyState icon={HandCoins} title="No contributions found" description="Recorded tithes, offerings and donations will appear here." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Contributor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="hidden sm:table-cell">Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.map((c) => (
                  <TableRow key={c.id} className={c.status === "voided" ? "text-muted-foreground line-through decoration-1" : undefined}>
                    <TableCell className="whitespace-nowrap">
                      <Link href={`/giving/${c.id}`} className="hover:text-primary">
                        {formatDate(c.contribution_date)}
                      </Link>
                    </TableCell>
                    <TableCell>{c.is_anonymous ? <span className="italic">Anonymous</span> : (c.members?.full_name ?? c.contributor_name ?? "—")}</TableCell>
                    <TableCell>{c.giving_categories?.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{c.payment_method === "pos" ? "POS" : titleCase(c.payment_method)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(c.amount, currency)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <StatusBadge status={c.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} total={count ?? 0} basePath="/giving" params={{ ...f }} />
          </>
        )}
      </Card>
    </>
  );
}
