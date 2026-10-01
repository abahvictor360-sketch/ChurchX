"use client";

import * as React from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { voidContribution } from "@/features/giving/actions";
import { useAction } from "@/hooks/use-action";

export function VoidContributionButton({ id }: { id: string }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const { run, pending } = useAction(voidContribution, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive">
          <Ban /> Void
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void this contribution?</DialogTitle>
          <DialogDescription>Voided records stay in the audit history but are excluded from totals and reports. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="void-reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea id="void-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate entry, wrong amount" maxLength={300} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending || reason.trim().length < 3} onClick={() => run(id, reason)}>
            Void contribution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
