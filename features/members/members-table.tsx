"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ChevronDown, PhoneCall, UsersRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmAction } from "@/components/app/confirm-action";
import { StatusBadge } from "@/components/app/status-badge";
import { AssignFollowupDialog, type Worker } from "@/features/followups/assign-dialog";
import { addMembersToDepartment, setMembersStatus } from "@/features/members/actions";
import { useAction } from "@/hooks/use-action";
import { formatDate, initials, titleCase } from "@/lib/format";
import { MEMBER_STATUSES } from "@/lib/validation";

export type MemberRow = {
  id: string;
  full_name: string;
  phone: string | null;
  membership_status: string;
  membership_number: string | null;
  join_date: string;
};

export function MembersTable({
  rows,
  canManage,
  canAssign,
  canDepartments,
  departments,
  workers,
  today,
}: {
  rows: MemberRow[];
  canManage: boolean;
  canAssign: boolean;
  canDepartments: boolean;
  departments: { id: string; name: string }[];
  workers: Worker[];
  today: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = React.useState(false);
  const ids = [...selected];
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someChecked = !allChecked && rows.some((r) => selected.has(r.id));
  const clear = () => setSelected(new Set());
  const status = useAction(setMembersStatus, { onSuccess: clear });
  const dept = useAction(addMembersToDepartment, { onSuccess: clear });
  const bulk = canManage || canAssign || canDepartments;

  const [prevRows, setPrevRows] = React.useState(rows);
  if (prevRows !== rows) {
    // New page/filter: drop selections that are no longer visible.
    setPrevRows(rows);
    setSelected(new Set());
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      {bulk && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-y bg-accent/50 px-4 py-2 text-sm" role="region" aria-label="Bulk actions">
          <span className="font-medium">{selected.size} selected</span>
          {canAssign && (
            <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
              <PhoneCall /> Assign follow-up
            </Button>
          )}
          {canDepartments && departments.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={dept.pending}>
                  <UsersRound /> Add to department <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {departments.map((d) => (
                  <DropdownMenuItem key={d.id} onSelect={() => dept.run(ids, d.id)}>
                    {d.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canManage && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={status.pending}>
                    Set status <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Change status to</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {MEMBER_STATUSES.filter((s) => s !== "archived").map((s) => (
                    <DropdownMenuItem key={s} onSelect={() => status.run(ids, s)}>
                      {titleCase(s)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <ConfirmAction
                trigger={
                  <Button size="sm" variant="outline" className="text-destructive">
                    <Archive /> Archive
                  </Button>
                }
                title={`Archive ${selected.size} ${selected.size === 1 ? "person" : "people"}?`}
                description="Archived members are hidden from lists and reports but their history (attendance, giving, follow-ups) is kept. You can restore them later by changing their status."
                confirmLabel="Archive"
                destructive
                action={() => setMembersStatus(ids, "archived")}
                onDone={clear}
              />
            </>
          )}
          <Button size="sm" variant="ghost" onClick={clear}>
            Clear
          </Button>
        </div>
      )}

      {/* Desktop/tablet table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {bulk && (
                <TableHead>
                  <Checkbox
                    checked={allChecked ? true : someChecked ? "indeterminate" : false}
                    onCheckedChange={(c) => setSelected(c ? new Set(rows.map((r) => r.id)) : new Set())}
                    aria-label="Select all on this page"
                  />
                </TableHead>
              )}
              <TableHead>Name</TableHead>
              <TableHead>Member no.</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.id} data-state={selected.has(m.id) ? "selected" : undefined} className="cursor-pointer" onClick={() => router.push(`/members/${m.id}`)}>
                {bulk && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} aria-label={`Select ${m.full_name}`} />
                  </TableCell>
                )}
                <TableCell>
                  <Link href={`/members/${m.id}`} className="flex items-center gap-3 font-medium hover:text-primary" onClick={(e) => e.stopPropagation()}>
                    <Avatar className="size-8">
                      <AvatarFallback>{initials(m.full_name)}</AvatarFallback>
                    </Avatar>
                    {m.full_name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">{m.membership_number ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{m.phone ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={m.membership_status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(m.join_date)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile list */}
      <ul className="divide-y md:hidden">
        {rows.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-3 py-3">
            {bulk && <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} aria-label={`Select ${m.full_name}`} />}
            <Link href={`/members/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback>{initials(m.full_name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{m.full_name}</span>
                <span className="block truncate text-xs text-muted-foreground">{[m.membership_number, m.phone].filter(Boolean).join(" · ") || "—"}</span>
              </span>
              <StatusBadge status={m.membership_status} />
            </Link>
          </li>
        ))}
      </ul>

      {canAssign && <AssignFollowupDialog open={assignOpen} onOpenChange={setAssignOpen} workers={workers} memberIds={ids} today={today} onDone={clear} />}
    </>
  );
}
