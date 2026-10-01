"use client";

import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markNotificationsRead } from "@/features/shell/actions";
import { useAction } from "@/hooks/use-action";

export function MarkAllReadButton() {
  const { run, pending } = useAction(markNotificationsRead, { success: "All notifications marked as read" });
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => run()}>
      <CheckCheck /> Mark all read
    </Button>
  );
}
