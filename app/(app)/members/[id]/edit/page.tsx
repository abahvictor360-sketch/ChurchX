import { notFound } from "next/navigation";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { MemberForm } from "@/features/members/member-form";
import { todayIn } from "@/lib/format";
import { z } from "zod";

export const metadata = { title: "Edit member" };

export default async function EditMemberPage({ params }: PageProps<"/members/[id]/edit">) {
  const ctx = await requireChurch("members.manage");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: member } = await supabase.from("members").select("*").eq("id", id).eq("church_id", ctx.church.id).maybeSingle();
  if (!member) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`Edit ${member.full_name}`}
        crumbs={[{ label: "Members", href: "/members" }, { label: member.full_name, href: `/members/${id}` }, { label: "Edit" }]}
      />
      <MemberForm member={member} defaultCountry={ctx.church.country} today={todayIn(ctx.church.timezone)} />
    </div>
  );
}
