"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/app/form-field";
import { nativeSelect } from "@/features/members/member-form";
import { assignFollowups } from "@/features/followups/actions";
import { useAction } from "@/hooks/use-action";
import { roleName } from "@/lib/permissions";

export type Worker = { id: string; name: string; role: string };

export function AssignFollowupDialog({
  open,
  onOpenChange,
  workers,
  memberIds = [],
  visitorIds = [],
  careAlertId,
  today,
  title = "Assign follow-up",
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workers: Worker[];
  memberIds?: string[];
  visitorIds?: string[];
  careAlertId?: string;
  today: string;
  title?: string;
  onDone?: () => void;
}) {
  const [assignee, setAssignee] = React.useState("");
  const [due, setDue] = React.useState(today);
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const { run, pending } = useAction(assignFollowups, {
    onSuccess: () => {
      onOpenChange(false);
      setNotes("");
      onDone?.();
    },
  });
  const count = memberIds.length + visitorIds.length;
  const sorted = [...workers].sort((a, b) => Number(b.role === "followup_worker") - Number(a.role === "followup_worker") || a.name.localeCompare(b.name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {count} {count === 1 ? "person" : "people"} will appear in the worker&apos;s follow-up list.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!assignee) return setError("Choose a worker");
            setError(null);
            await run({ assignee, member_ids: memberIds, visitor_ids: visitorIds, due_date: due, notes: notes || null, care_alert_id: careAlertId ?? null });
          }}
        >
          <Field label="Assign to" htmlFor="assignee" required error={error ?? undefined}>
            <select className={nativeSelect} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Choose a worker…</option>
              {sorted.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} — {roleName(w.role)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date" htmlFor="due_date" required>
            <Input type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="Instructions" htmlFor="assign_notes" hint="Optional — e.g. 'Welcome call, invite to newcomers class'">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || count === 0}>
              {pending && <Loader2 className="animate-spin" />} Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
