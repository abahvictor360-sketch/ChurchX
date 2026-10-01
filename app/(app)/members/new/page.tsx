import { requireChurch } from "@/lib/auth/context";
import { PageHeader } from "@/components/app/page-header";
import { MemberForm } from "@/features/members/member-form";
import { todayIn } from "@/lib/format";

export const metadata = { title: "Add member" };

export default async function NewMemberPage() {
  const ctx = await requireChurch("members.manage");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Add member" crumbs={[{ label: "Members", href: "/members" }, { label: "Add member" }]} />
      <MemberForm defaultCountry={ctx.church.country} today={todayIn(ctx.church.timezone)} />
    </div>
  );
}
