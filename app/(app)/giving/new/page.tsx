import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { ContributionForm } from "@/features/giving/contribution-form";
import { todayIn } from "@/lib/format";

export const metadata = { title: "Record contribution" };

export default async function NewContributionPage() {
  const ctx = await requireChurch("giving.manage");
  const supabase = await createClient();
  const { data: categories } = await supabase.from("giving_categories").select("id, name").eq("church_id", ctx.church.id).eq("is_active", true).order("sort_order");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Record contribution" crumbs={[{ label: "Contributions", href: "/giving" }, { label: "Record" }]} />
      <ContributionForm categories={categories ?? []} currency={ctx.church.currency} today={todayIn(ctx.church.timezone)} />
    </div>
  );
}
