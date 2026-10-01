"use client";

import { CalendarPlus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { generateServices, setServiceStatus } from "@/features/services/actions";
import { useAction } from "@/hooks/use-action";
import { SERVICE_STATUSES } from "@/lib/validation";
import { titleCase } from "@/lib/format";

export function GenerateServicesButton() {
  const { run, pending } = useAction(generateServices);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          <CalendarPlus /> Auto-schedule <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>From service-type default days</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {[1, 4, 8].map((w) => (
          <DropdownMenuItem key={w} onSelect={() => run(w)}>
            Next {w} week{w > 1 ? "s" : ""}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ServiceStatusMenu({ id, status }: { id: string; status: string }) {
  const { run, pending } = useAction(setServiceStatus);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          Status: {titleCase(status)} <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SERVICE_STATUSES.filter((s) => s !== status).map((s) => (
          <DropdownMenuItem key={s} onSelect={() => run(id, s)}>
            Mark {s}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
