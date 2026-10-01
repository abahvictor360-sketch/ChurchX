"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import type { ActionResult } from "@/lib/actions";

/** Button + confirmation dialog for destructive or important actions. */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  action,
  success,
  onDone,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  action: () => Promise<ActionResult<unknown>>;
  success?: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const { run, pending } = useAction(action, { success, onSuccess: () => onDone?.() });
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={async () => {
              const res = await run();
              if (res?.ok) setOpen(false);
            }}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
