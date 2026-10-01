"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { MessageCircle, Pencil, Phone, PhoneCall, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { AssignFollowupDialog, type Worker } from "@/features/followups/assign-dialog";
import { nativeSelect } from "@/features/members/member-form";
import { convertVisitor, setVisitorStatus } from "@/features/visitors/actions";
import { useAction } from "@/hooks/use-action";
import { titleCase } from "@/lib/format";
import { VISITOR_STATUSES } from "@/lib/validation";

export function VisitorStatusSelect({ id, status }: { id: string; status: string }) {
  const { run, pending } = useAction(setVisitorStatus);
  return (
    <select
      aria-label="Visitor status"
      className={`${nativeSelect} w-auto`}
      defaultValue={status}
      disabled={pending}
      onChange={(e) => run(id, e.target.value)}
    >
      {VISITOR_STATUSES.filter((s) => s !== "converted").map((s) => (
        <option key={s} value={s}>
          {s === "unreachable" ? "Unable to reach" : titleCase(s)}
        </option>
      ))}
    </select>
  );
}

export function VisitorActions({
  visitor,
  tel,
  whatsapp,
  canManage,
  canConvert,
  canAssign,
  workers,
  today,
}: {
  visitor: { id: string; first_name: string; last_name: string | null; date_of_birth?: string | null; converted: boolean };
  tel: string | null;
  whatsapp: string | null;
  canManage: boolean;
  canConvert: boolean;
  canAssign: boolean;
  workers: Worker[];
  today: string;
}) {
  const [convertOpen, setConvertOpen] = React.useState(false);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [state, action] = useActionState(convertVisitor.bind(null, visitor.id), null);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  return (
    <div className="flex flex-wrap gap-2">
      {tel && (
        <Button asChild variant="outline" size="sm">
          <a href={tel}>
            <Phone /> Call
          </a>
        </Button>
      )}
      {whatsapp && (
        <Button asChild variant="outline" size="sm">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> WhatsApp
          </a>
        </Button>
      )}
      {canAssign && !visitor.converted && (
        <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
          <PhoneCall /> Assign follow-up
        </Button>
      )}
      {canManage && !visitor.converted && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/visitors/${visitor.id}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      )}
      {canConvert && !visitor.converted && (
        <Button size="sm" onClick={() => setConvertOpen(true)}>
          <UserCheck /> Convert to member
        </Button>
      )}

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to member</DialogTitle>
            <DialogDescription>
              Their contact details, follow-up history and event registrations are carried over automatically. Add anything that&apos;s missing.
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="grid gap-4">
            <FormError message={state && !state.ok ? state.error : null} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="cv_first_name" error={fe("first_name")}>
                <Input name="first_name" defaultValue={visitor.first_name} />
              </Field>
              <Field label="Last name" htmlFor="cv_last_name" required error={fe("last_name")}>
                <Input name="last_name" defaultValue={visitor.last_name ?? ""} />
              </Field>
              <Field label="Date of birth" htmlFor="cv_dob" error={fe("date_of_birth")}>
                <Input name="date_of_birth" type="date" max={today} />
              </Field>
              <Field label="Join date" htmlFor="cv_join" required error={fe("join_date")}>
                <Input name="join_date" type="date" defaultValue={today} />
              </Field>
              <Field label="Membership status" htmlFor="cv_status" className="sm:col-span-2">
                <select name="membership_status" defaultValue="new_member" className={nativeSelect}>
                  <option value="new_member">New member</option>
                  <option value="active">Active</option>
                </select>
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setConvertOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pendingText="Converting…">Convert to member</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {canAssign && (
        <AssignFollowupDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          workers={workers}
          visitorIds={[visitor.id]}
          today={today}
          title={`Assign follow-up for ${visitor.first_name}`}
        />
      )}
    </div>
  );
}
