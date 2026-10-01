"use client";

import { UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/app/confirm-action";
import { leaveDepartment } from "@/features/members/actions";

export function LeaveDepartmentButton({ id, name, department }: { id: string; name: string; department: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm">
          <UserMinus /> Remove
        </Button>
      }
      title={`Remove ${name} from ${department}?`}
      description="Their membership will be ended today. The history of when they served is kept."
      confirmLabel="Remove"
      destructive
      action={() => leaveDepartment(id)}
    />
  );
}
