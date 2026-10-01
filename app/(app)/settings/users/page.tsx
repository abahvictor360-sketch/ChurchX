import { requireChurch } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { InviteUserDialog, UserMemberLink, UserRoleSelect, UserStatusButton } from "@/features/users/users-ui";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Users & roles" };

export default async function UsersPage() {
  const ctx = await requireChurch("users.manage");
  const supabase = await createClient();
  const { data } = await supabase
    .from("church_users")
    .select("id, user_id, role, status, invited_email, invited_at, activated_at, member_id, profiles(full_name, email), members(id, full_name, membership_number)")
    .eq("church_id", ctx.church.id)
    .order("status")
    .order("created_at");
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Users & roles</CardTitle>
          <CardDescription className="mt-1">Permissions are enforced by the database, not just hidden in the app.</CardDescription>
        </div>
        <InviteUserDialog />
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="hidden lg:table-cell">Linked member</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((u) => {
            const self = u.user_id === ctx.userId;
            return (
              <TableRow key={u.id}>
                <TableCell>
                  <p className="font-medium">
                    {u.profiles?.full_name ?? u.invited_email ?? "—"}
                    {self && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{u.profiles?.email ?? u.invited_email}</p>
                  {u.status === "invited" && u.invited_at && <p className="text-xs text-muted-foreground">Invited {formatDate(u.invited_at)}</p>}
                </TableCell>
                <TableCell>
                  <UserRoleSelect id={u.id} role={u.role} disabled={self} />
                </TableCell>
                <TableCell className="hidden min-w-56 lg:table-cell">
                  <UserMemberLink id={u.id} member={u.members ? { id: u.members.id, kind: "member", name: u.members.full_name, detail: u.members.membership_number } : null} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={u.status} />
                </TableCell>
                <TableCell className="text-right">{!self && <UserStatusButton id={u.id} status={u.status} />}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="border-t px-5 py-3 text-xs text-muted-foreground">
        Your own role can&apos;t be changed here, and a church always keeps at least one active Church Admin.
      </p>
    </Card>
  );
}
