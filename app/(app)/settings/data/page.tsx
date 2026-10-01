import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { requireChurch } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Import / export" };

export default async function DataPage() {
  const ctx = await requireChurch("data.import", "data.export");
  const exports = [
    { href: "/api/export/members", label: "Members", show: ctx.can("members.view") },
    { href: "/api/export/visitors", label: "Visitors", show: ctx.can("visitors.view") },
    { href: "/api/export/contributions?status=all", label: "Contributions (this year)", show: ctx.can("giving.view") },
    { href: "/api/export/service-attendance", label: "Attendance by service (this year)", show: ctx.can("reports.view", "attendance.view") },
    { href: "/api/export/departments", label: "Department membership", show: ctx.can("reports.view", "departments.view") },
  ].filter((e) => e.show && ctx.can("data.export"));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {ctx.can("data.import") && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Import</CardTitle>
              <CardDescription className="mt-1">Bring existing member lists from Excel or Google Sheets (CSV).</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/members/import">
                <Upload /> Import members from CSV
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {exports.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Export</CardTitle>
              <CardDescription className="mt-1">CSV files open in Excel and Google Sheets. Exports only include data your role may see.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {exports.map((e) => (
              <Button key={e.href} asChild variant="outline" className="justify-start">
                <a download href={e.href}>
                  <Download /> {e.label}
                </a>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
