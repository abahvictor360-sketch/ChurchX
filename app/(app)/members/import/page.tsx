import { requireChurch } from "@/lib/auth/context";
import { PageHeader } from "@/components/app/page-header";
import { MemberImport } from "@/features/import/member-import";

export const metadata = { title: "Import members" };

export default async function ImportPage() {
  await requireChurch("data.import");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Import members" crumbs={[{ label: "Members", href: "/members" }, { label: "Import" }]} />
      <MemberImport />
    </div>
  );
}
