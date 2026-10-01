"use client";

import * as React from "react";
import { useActionState } from "react";
import { Check, MoreHorizontal, Undo2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { PersonPicker } from "@/components/app/person-picker";
import { cancelRegistration, registerForEvent, setRegistrationAttended } from "@/features/events/actions";
import { useAction, useActionToast } from "@/hooks/use-action";

export function RegisterAttendee({ eventId, disabledReason }: { eventId: string; disabledReason?: string | null }) {
  const [mode, setMode] = React.useState<"person" | "guest">("person");
  const [formKey, setFormKey] = React.useState(0);
  const [state, action] = useActionState(registerForEvent.bind(null, eventId), null);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  useActionToast(state, () => setFormKey((k) => k + 1));
  if (disabledReason) return <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{disabledReason}</p>;
  return (
    <form key={formKey} action={action} className="grid gap-3">
      <div role="tablist" className="inline-flex w-fit rounded-md border p-0.5 text-sm">
        {(
          [
            ["person", "Member / visitor"],
            ["guest", "Walk-in guest"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`rounded px-3 py-1 ${mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {l}
          </button>
        ))}
      </div>
      <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
      {mode === "person" ? (
        <Field label="Person" htmlFor="person" error={fe("guest_name")}>
          <PersonPicker name="person" kind="all" placeholder="Search members and visitors…" />
        </Field>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Guest name" htmlFor="guest_name" required error={fe("guest_name")}>
            <Input name="guest_name" />
          </Field>
          <Field label="Phone" htmlFor="guest_phone" error={fe("guest_phone")}>
            <Input name="guest_phone" type="tel" inputMode="tel" />
          </Field>
          <Field label="Email" htmlFor="guest_email" error={fe("guest_email")}>
            <Input name="guest_email" type="email" />
          </Field>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox id={`checkin-now-${eventId}`} name="check_in_now" />
          <Label htmlFor={`checkin-now-${eventId}`}>Check in now (they&apos;re here)</Label>
        </div>
        <SubmitButton size="sm">
          <UserPlus /> Register
        </SubmitButton>
      </div>
    </form>
  );
}

export function RegistrationRowActions({ id, attended, cancelled }: { id: string; attended: boolean; cancelled: boolean }) {
  const toggle = useAction(setRegistrationAttended);
  const cancel = useAction(cancelRegistration);
  if (cancelled) return null;
  return (
    <div className="flex items-center gap-1">
      {attended ? (
        <Button size="sm" variant="ghost" disabled={toggle.pending} onClick={() => toggle.run(id, false)}>
          <Undo2 /> Undo
        </Button>
      ) : (
        <Button size="sm" className="h-10 sm:h-8" disabled={toggle.pending} onClick={() => toggle.run(id, true)}>
          <Check /> Check in
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="More">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => cancel.run(id)}>
            <X /> Cancel registration
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
