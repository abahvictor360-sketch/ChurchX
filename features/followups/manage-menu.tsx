"use client";

import * as React from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/form-field";
import { nativeSelect } from "@/features/members/member-form";
import { cancelFollowup, reassignFollowup } from "@/features/followups/actions";
import { useAction } from "@/hooks/use-action";
import type { Worker } from "@/features/followups/assign-dialog";

export function FollowupManageMenu({ id, workers, today, currentAssignee }: { id: string; workers: Worker[]; today: string; currentAssignee: string }) {
  const [open, setOpen] = React.useState(false);
  const [assignee, setAssignee] = React.useState(currentAssignee);
  const [due, setDue] = React.useState(today);
  const reassign = useAction(reassignFollowup, { onSuccess: () => setOpen(false) });
  const cancel = useAction(cancelFollowup);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Manage follow-up">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setOpen(true)}>Reassign / reschedule</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => cancel.run(id)}>
            Cancel follow-up
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign follow-up</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Worker" htmlFor={`re-${id}`} required>
              <select className={nativeSelect} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due date" htmlFor={`due-${id}`} required>
              <Input type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={reassign.pending} onClick={() => reassign.run(id, assignee, due)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
