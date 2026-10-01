import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { ChurchProfileForm, MemberPrefixEditor, ServiceDaysEditor } from "@/features/church/church-profile-form";
import { LogoUploader } from "@/features/church/logo-uploader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Church profile" };

export default async function ChurchSettingsPage() {
  const ctx = await requireChurch("church.manage");
  const supabase = await createClient();
  const [{ data: church }, { data: settings }] = await Promise.all([
    supabase.from("churches").select("*").eq("id", ctx.church.id).single(),
    supabase.from("church_settings").select("default_service_days, member_number_prefix").eq("church_id", ctx.church.id).single(),
  ]);
  if (!church) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Church profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ChurchProfileForm church={church} />
        </CardContent>
      </Card>
      <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Branding</CardTitle>
              <CardDescription className="mt-1">Your logo appears in the sidebar.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <LogoUploader churchId={church.id} currentPath={church.logo_path} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Default service days</CardTitle>
          </CardHeader>
          <CardContent>
            <ServiceDaysEditor initial={settings?.default_service_days ?? [0]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Membership numbers</CardTitle>
          </CardHeader>
          <CardContent>
            <MemberPrefixEditor initial={settings?.member_number_prefix ?? "CX"} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
