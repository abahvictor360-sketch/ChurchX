import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

/** Recent and upcoming services for linking a visitor's first visit. */
export async function recentServices(supabase: ServerSupabase, churchId: string, today: string) {
  const { data } = await supabase
    .from("services")
    .select("id, name, service_date")
    .eq("church_id", churchId)
    .neq("status", "cancelled")
    .lte("service_date", today)
    .order("service_date", { ascending: false })
    .limit(15);
  return data ?? [];
}
