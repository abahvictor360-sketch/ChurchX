"use client";

import * as React from "react";
import { CheckCircle2, MessageCircle, Phone, PhoneCall, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AssignFollowupDialog, type Worker } from "@/features/followups/assign-dialog";
import { refreshCare, resolveCareAlert } from "@/features/care/actions";
import { useAction } from "@/hooks/use-action";

export function RefreshCareButton() {
  const { run, pending } = useAction(refreshCare);
  return (
    <Button variant="outline" size="sm" onClick={() => run()} disabled={pending}>
      <RefreshCw className={pending ? "animate-spin" : undefined} /> Recalculate
    </Button>
  );
}

export function CareAlertActions({
  alertId,
  name,
  memberId,
  visitorId,
  tel,
  whatsapp,
  canManage,
  canAssign,
  workers,
  today,
}: {
  alertId: string;
  name: string;
  memberId: string | null;
  visitorId: string | null;
  tel: string | null;
  whatsapp: string | null;
  canManage: boolean;
  canAssign: boolean;
  workers: Worker[];
  today: string;
}) {
  const [assign, setAssign] = React.useState(false);
  const [resolveOpen, setResolveOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const resolve = useAction(resolveCareAlert, { onSuccess: () => setResolveOpen(false) });
  return (
    <div className="flex flex-wrap gap-2">
      {tel && (
        <Button asChild variant="outline" size="sm" className="h-10 sm:h-8">
          <a href={tel}>
            <Phone /> Call
          </a>
        </Button>
      )}
      {whatsapp && (
        <Button asChild variant="outline" size="sm" className="h-10 sm:h-8">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> WhatsApp
          </a>
        </Button>
      )}
      {canAssign && (
        <Button variant="outline" size="sm" className="h-10 sm:h-8" onClick={() => setAssign(true)}>
          <PhoneCall /> Assign follow-up
        </Button>
      )}
      {canManage && (
        <Button size="sm" className="h-10 sm:h-8" onClick={() => setResolveOpen(true)}>
          <CheckCircle2 /> Mark resolved
        </Button>
      )}
      {canAssign && (
        <AssignFollowupDialog
          open={assign}
          onOpenChange={setAssign}
          workers={workers}
          memberIds={memberId ? [memberId] : []}
          visitorIds={!memberId && visitorId ? [visitorId] : []}
          careAlertId={alertId}
          today={today}
          title={`Follow up with ${name}`}
        />
      )}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as resolved</DialogTitle>
            <DialogDescription>Record what was done for {name}. The alert will close until the situation changes again.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`note-${alertId}`}>Note (optional)</Label>
            <Textarea id={`note-${alertId}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. Pastor visited; travelling for work until next month" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolveOpen(false)}>
              Cancel
            </Button>
            <Button disabled={resolve.pending} onClick={() => resolve.run(alertId, note)}>
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
