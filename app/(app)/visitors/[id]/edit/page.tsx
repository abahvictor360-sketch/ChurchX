import { notFound } from "next/navigation";
import { z } from "zod";
import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { VisitorForm } from "@/features/visitors/visitor-form";
import { recentServices } from "@/features/visitors/queries";
import { todayIn } from "@/lib/format";

export const metadata = { title: "Edit visitor" };

export default async function EditVisitorPage({ params }: PageProps<"/visitors/[id]/edit">) {
  const ctx = await requireChurch("visitors.manage");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const today = todayIn(ctx.church.timezone);
  const [{ data: visitor }, services] = await Promise.all([
    supabase.from("visitors").select("*").eq("id", id).eq("church_id", ctx.church.id).maybeSingle(),
    recentServices(supabase, ctx.church.id, today),
  ]);
  if (!visitor) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`Edit ${visitor.full_name}`} crumbs={[{ label: "Visitors", href: "/visitors" }, { label: visitor.full_name, href: `/visitors/${id}` }, { label: "Edit" }]} />
      <VisitorForm visitor={visitor} services={services} today={today} />
    </div>
  );
}
