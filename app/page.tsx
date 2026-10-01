import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/env";
import { SetupNotice } from "@/components/app/setup-notice";

export default async function Home() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const user = await getUser();
  redirect(user ? "/dashboard" : "/login");
}
