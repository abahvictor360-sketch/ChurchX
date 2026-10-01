import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { VisitorForm } from "@/features/visitors/visitor-form";
import { recentServices } from "@/features/visitors/queries";
import { todayIn } from "@/lib/format";

export const metadata = { title: "Register visitor" };

export default async function NewVisitorPage({ searchParams }: PageProps<"/visitors/new">) {
  const ctx = await requireChurch("visitors.create", "visitors.manage");
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayIn(ctx.church.timezone);
  const services = ctx.can("services.view", "attendance.record", "services.manage") ? await recentServices(supabase, ctx.church.id, today) : [];
  const todays = services.find((s) => s.service_date === today);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Register visitor" description="Welcome a first-timer. Only the first name is required." crumbs={[{ label: "Visitors", href: "/visitors" }, { label: "Register" }]} />
      <VisitorForm services={services} today={today} defaultServiceId={typeof sp.service === "string" ? sp.service : todays?.id} />
    </div>
  );
}
