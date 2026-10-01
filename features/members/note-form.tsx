"use client";

import * as React from "react";
import { useActionState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormError, SubmitButton } from "@/components/app/form-field";
import { addMemberNote } from "@/features/members/actions";
import { useActionToast } from "@/hooks/use-action";

export function NoteForm({ memberId, canConfidential }: { memberId: string; canConfidential: boolean }) {
  const [state, action] = useActionState(addMemberNote.bind(null, memberId), null);
  const ref = React.useRef<HTMLFormElement>(null);
  useActionToast(state, () => ref.current?.reset());
  return (
    <form ref={ref} action={action} className="grid gap-3">
      <Label htmlFor="note-body" className="sr-only">
        New note
      </Label>
      <Textarea id="note-body" name="body" rows={3} placeholder="Write a note…" maxLength={4000} aria-invalid={state && !state.ok && state.fieldErrors?.body ? true : undefined} />
      <FormError message={state && !state.ok ? (state.fieldErrors?.body ?? state.error) : null} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {canConfidential ? (
          <fieldset className="flex items-center gap-4 text-sm">
            <legend className="sr-only">Visibility</legend>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="visibility" value="general" defaultChecked className="accent-[var(--color-primary)]" /> General
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="visibility" value="confidential" className="accent-[var(--color-primary)]" /> Confidential (pastoral)
            </label>
          </fieldset>
        ) : (
          <input type="hidden" name="visibility" value="general" />
        )}
        <SubmitButton size="sm">Add note</SubmitButton>
      </div>
    </form>
  );
}
