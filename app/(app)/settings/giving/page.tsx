import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { CategoryDialog } from "@/features/church/simple-crud";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Giving categories" };

export default async function GivingSettingsPage() {
  const ctx = await requireChurch("church.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("giving_categories").select("id, name, description, is_active").eq("church_id", ctx.church.id).order("sort_order").order("name");
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Giving categories</CardTitle>
          <CardDescription className="mt-1">Categories are never deleted so past records stay intact — disable ones you no longer use.</CardDescription>
        </div>
        <CategoryDialog />
      </CardHeader>
      <ul className="divide-y border-t">
        {(data ?? []).map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <div>
              <p className="font-medium">{c.name}</p>
              {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={c.is_active ? "green" : "gray"}>{c.is_active ? "Active" : "Disabled"}</Badge>
              <CategoryDialog category={c} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
