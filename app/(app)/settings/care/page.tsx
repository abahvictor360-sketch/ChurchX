import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { CareRulesForm } from "@/features/care/rules-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Member care rules" };

export default async function CareRulesPage() {
  const ctx = await requireChurch("church.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("church_settings").select("care_rules").eq("church_id", ctx.church.id).single();
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Member care rules</CardTitle>
          <CardDescription className="mt-1">
            Alerts are recalculated automatically (at most every 10 minutes) from attendance at services whose type counts for absence alerts.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <CareRulesForm rules={(data?.care_rules ?? {}) as Record<string, number>} />
      </CardContent>
    </Card>
  );
}
