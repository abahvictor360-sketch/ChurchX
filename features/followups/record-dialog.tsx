"use client";

import * as React from "react";
import { useActionState } from "react";
import { ClipboardPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { nativeSelect } from "@/features/members/member-form";
import { completeFollowup } from "@/features/followups/actions";
import { useActionToast } from "@/hooks/use-action";
import { CONTACT_METHODS, OUTCOMES } from "@/lib/validation";
import { titleCase } from "@/lib/format";

const METHOD_LABEL: Record<string, string> = { phone: "Phone call", whatsapp: "WhatsApp", sms: "SMS", email: "Email", visit: "Physical visit", other: "Other" };

export function RecordFollowupDialog({ followupId, personName, isVisitor, today }: { followupId: string; personName: string; isVisitor: boolean; today: string }) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = useActionState(completeFollowup, null);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  useActionToast(state, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-10 sm:h-8">
          <ClipboardPen /> Record follow-up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record follow-up</DialogTitle>
          <DialogDescription>How did your contact with {personName} go?</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <input type="hidden" name="followup_id" value={followupId} />
          <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
          <Field label="How did you make contact?" htmlFor="contact_method" required error={fe("contact_method")}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Contact method">
              {CONTACT_METHODS.map((m) => (
                <label key={m} className="flex h-11 cursor-pointer items-center justify-center rounded-md border bg-card px-2 text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                  <input type="radio" name="contact_method" value={m} className="sr-only" />
                  {METHOD_LABEL[m]}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Outcome" htmlFor="outcome" required error={fe("outcome")}>
            <select name="outcome" defaultValue="" className={nativeSelect}>
              <option value="" disabled>
                Choose outcome…
              </option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {titleCase(o)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes" htmlFor="notes" error={fe("notes")}>
            <Textarea name="notes" rows={3} placeholder="What was discussed? Any prayer needs?" maxLength={4000} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Schedule next follow-up" htmlFor="next_followup_date" error={fe("next_followup_date")} hint="Leave empty if no further follow-up is needed">
              <Input type="date" name="next_followup_date" min={today} />
            </Field>
            {isVisitor && (
              <Field label="Visitor status" htmlFor="visitor_status" error={fe("visitor_status")}>
                <select name="visitor_status" defaultValue="" className={nativeSelect}>
                  <option value="">Keep / mark contacted</option>
                  <option value="followup_ongoing">Follow-up ongoing</option>
                  <option value="interested">Interested</option>
                  <option value="not_interested">Not interested</option>
                  <option value="unreachable">Unable to reach</option>
                </select>
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>Save follow-up</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
