import { notFound } from "next/navigation";
import { z } from "zod";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { ContributionForm } from "@/features/giving/contribution-form";
import { VoidContributionButton } from "@/features/giving/void-button";
import { formatDate, formatDateTime, formatMoney, titleCase, todayIn } from "@/lib/format";

export const metadata = { title: "Contribution" };

export default async function ContributionPage({ params }: PageProps<"/giving/[id]">) {
  const ctx = await requireChurch("giving.view");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("contributions")
    .select("*, members(id, full_name, membership_number), giving_categories(name), recorder:profiles!contributions_recorded_by_fkey(full_name)")
    .eq("id", id)
    .eq("church_id", ctx.church.id)
    .maybeSingle();
  if (!c) notFound();
  const editable = c.status === "recorded" && ctx.can("giving.manage");
  const { data: categories } = editable
    ? await supabase.from("giving_categories").select("id, name").eq("church_id", ctx.church.id).order("sort_order")
    : { data: [] };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={formatMoney(c.amount, c.currency)}
        description={`${c.giving_categories?.name} · ${formatDate(c.contribution_date)}`}
        crumbs={[{ label: "Contributions", href: "/giving" }, { label: "Contribution" }]}
        actions={
          <>
            <StatusBadge status={c.status} />
            {editable && <VoidContributionButton id={c.id} />}
          </>
        }
      />
      <Card className="mb-4">
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Recorded by:</span> {c.recorder?.full_name ?? "—"} on {formatDateTime(c.created_at)}
          </p>
          <p>
            <span className="text-muted-foreground">Source:</span> {titleCase(c.source)}
          </p>
          {c.status === "voided" && (
            <p className="sm:col-span-2">
              <span className="text-muted-foreground">Voided:</span> {formatDateTime(c.voided_at)} — {c.void_reason}
            </p>
          )}
        </CardContent>
      </Card>
      {editable && (
        <ContributionForm
          categories={categories ?? []}
          currency={c.currency}
          today={todayIn(ctx.church.timezone)}
          defaults={{
            id: c.id,
            member: c.members ? { id: c.members.id, kind: "member", name: c.members.full_name, detail: c.members.membership_number } : null,
            is_anonymous: c.is_anonymous,
            contributor_name: c.contributor_name,
            category_id: c.category_id,
            amount: Number(c.amount),
            contribution_date: c.contribution_date,
            payment_method: c.payment_method,
            reference: c.reference,
            notes: c.notes,
          }}
        />
      )}
    </div>
  );
}
