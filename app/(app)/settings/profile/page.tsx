import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm, ProfileForm } from "@/features/users/profile-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleName } from "@/lib/permissions";

export const metadata = { title: "My profile" };

export default async function ProfilePage() {
  const ctx = await requireChurch();
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("full_name, phone, email").eq("id", ctx.userId).single();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>My profile</CardTitle>
          <span className="text-sm text-primary">{roleName(ctx.role)}</span>
        </CardHeader>
        <CardContent>
          <ProfileForm fullName={p?.full_name ?? ""} phone={p?.phone ?? ""} email={p?.email ?? ctx.email ?? ""} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
