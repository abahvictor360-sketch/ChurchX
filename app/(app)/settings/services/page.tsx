import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { ServiceTypeDialog, ToggleServiceType } from "@/features/church/simple-crud";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WEEKDAYS } from "@/lib/locales";
import { formatTime } from "@/lib/format";

export const metadata = { title: "Service types" };

export default async function ServiceTypesPage() {
  const ctx = await requireChurch("services.manage");
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_types")
    .select("id, name, description, default_day, default_start_time, default_end_time, include_in_care, is_active")
    .eq("church_id", ctx.church.id)
    .order("is_active", { ascending: false })
    .order("name");
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Service types</CardTitle>
          <CardDescription className="mt-1">Types with a usual day can be auto-scheduled from the Services page.</CardDescription>
        </div>
        <ServiceTypeDialog />
      </CardHeader>
      <ul className="divide-y border-t">
        {(data ?? []).map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div>
              <p className="font-medium">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                {t.default_day !== null ? WEEKDAYS[t.default_day] : "No usual day"}
                {t.default_start_time ? ` · ${formatTime(t.default_start_time)}` : ""}
                {t.include_in_care ? " · counts for absence alerts" : " · not counted for absence"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant={t.is_active ? "green" : "gray"}>{t.is_active ? "Active" : "Disabled"}</Badge>
              <ServiceTypeDialog type={t} />
              <ToggleServiceType id={t.id} active={t.is_active} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
