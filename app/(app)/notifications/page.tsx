import Link from "next/link";
import { Bell } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { MarkAllReadButton } from "@/features/shell/mark-all-read";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Pagination, pageRange, parsePage } from "@/components/app/pagination";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateTime, titleCase } from "@/lib/format";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const ctx = await requireChurch();
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const supabase = await createClient();
  const { from, to } = pageRange(page);
  const { data, count } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at", { count: "exact" })
    .eq("church_id", ctx.church.id)
    .order("created_at", { ascending: false })
    .range(from, to);
  const rows = data ?? [];
  return (
    <>
      <PageHeader
        title="Notifications"
        description="In-app notifications. Email, SMS and WhatsApp delivery are not enabled yet."
        crumbs={[{ label: "Notifications" }]}
        actions={rows.some((r) => !r.read_at) ? <MarkAllReadButton /> : undefined}
      />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="You'll be notified about follow-ups due, birthdays, upcoming events and member-care alerts." />
        ) : (
          <>
            <ul className="divide-y">
              {rows.map((n) => (
                <li key={n.id}>
                  <Link href={n.link ?? "#"} className={cn("flex gap-3 px-5 py-4 hover:bg-muted", !n.read_at && "bg-accent/40")}>
                    <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{n.title}</span>
                        <Badge variant="muted">{titleCase(n.type)}</Badge>
                        {!n.read_at && <span className="sr-only">Unread</span>}
                      </span>
                      {n.body && <span className="block text-sm text-muted-foreground">{n.body}</span>}
                      <span className="block text-xs text-muted-foreground">{formatDateTime(n.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={page} total={count ?? 0} basePath="/notifications" params={{}} />
          </>
        )}
      </Card>
    </>
  );
}
