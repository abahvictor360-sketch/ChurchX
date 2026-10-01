"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchChurch } from "@/features/shell/actions";
import { initials } from "@/lib/format";
import { roleName } from "@/lib/permissions";

export function ChurchSwitcher({
  church,
  churches,
}: {
  church: { id: string; name: string; logoUrl: string | null };
  churches: { id: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const current = churches.find((c) => c.id === church.id);
  const content = (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar className="size-9 rounded-md">
        {church.logoUrl && <AvatarImage src={church.logoUrl} alt="" />}
        <AvatarFallback className="rounded-md">{initials(church.name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 text-left">
        <span className="block truncate text-sm font-semibold">{church.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{current ? roleName(current.role) : ""}</span>
      </span>
    </span>
  );
  if (churches.length <= 1) return <div className="rounded-md px-1 py-1">{content}</div>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {content}
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">Switch church</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Switch church</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {churches.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onSelect={async () => {
              if (c.id === church.id) return;
              const res = await switchChurch(c.id);
              if (!res.ok) toast.error(res.error);
              else router.push("/dashboard");
              router.refresh();
            }}
          >
            <span className="flex-1 truncate">{c.name}</span>
            {c.id === church.id && <Check className="text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
