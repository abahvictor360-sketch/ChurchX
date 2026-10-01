"use client";

import * as React from "react";
import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { PersonPicker } from "@/components/app/person-picker";
import { nativeSelect } from "@/features/members/member-form";
import { inviteUser, updateChurchUser } from "@/features/users/actions";
import { useAction, useActionToast } from "@/hooks/use-action";
import { ROLES } from "@/lib/permissions";
import type { PersonOption } from "@/features/people/actions";

const ROLE_HELP: Record<string, string> = {
  church_admin: "Full access to everything in this church.",
  pastor: "Members, attendance, follow-up, member care and reports. No giving.",
  finance: "Contributions and financial reports only.",
  department_leader: "Only the departments they lead (link their member record).",
  followup_worker: "Only people assigned to them for follow-up.",
  attendance_worker: "Check-in and visitor registration. No contact details or giving.",
};

export function InviteUserDialog() {
  const [open, setOpen] = React.useState(false);
  const [role, setRole] = React.useState("followup_worker");
  const [state, action] = useActionState(inviteUser, null);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  useActionToast(state, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus /> Invite user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>They&apos;ll receive an email to set a password. Church members don&apos;t need accounts — only staff and volunteers who use ChurchX.</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
          <Field label="Email" htmlFor="email" required error={fe("email")}>
            <Input name="email" type="email" inputMode="email" autoComplete="off" />
          </Field>
          <Field label="Full name" htmlFor="full_name" error={fe("full_name")}>
            <Input name="full_name" />
          </Field>
          <Field label="Role" htmlFor="role" required error={fe("role")} hint={ROLE_HELP[role]}>
            <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className={nativeSelect}>
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Linked member record" htmlFor="member_id" hint="Required for department leaders; optional otherwise">
            <PersonPicker name="member_id" kind="member" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Sending…">Send invitation</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UserRoleSelect({ id, role, disabled }: { id: string; role: string; disabled?: boolean }) {
  const { run, pending } = useAction(updateChurchUser);
  return (
    <select aria-label="Role" defaultValue={role} disabled={disabled || pending} onChange={(e) => run(id, { role: e.target.value })} className={`${nativeSelect} w-auto min-w-40`}>
      {ROLES.map((r) => (
        <option key={r.key} value={r.key}>
          {r.name}
        </option>
      ))}
    </select>
  );
}

export function UserStatusButton({ id, status, disabled }: { id: string; status: string; disabled?: boolean }) {
  const { run, pending } = useAction(updateChurchUser);
  if (status === "disabled")
    return (
      <Button variant="outline" size="sm" disabled={disabled || pending} onClick={() => run(id, { status: "active" })}>
        Re-enable
      </Button>
    );
  return (
    <Button variant="ghost" size="sm" className="text-destructive" disabled={disabled || pending} onClick={() => run(id, { status: "disabled" })}>
      Disable
    </Button>
  );
}

export function UserMemberLink({ id, member }: { id: string; member: PersonOption | null }) {
  const { run } = useAction(updateChurchUser);
  return <PersonPicker kind="member" defaultValue={member} placeholder="Link member…" onChange={(p) => run(id, { member_id: p?.id ?? null })} />;
}
