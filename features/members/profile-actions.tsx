"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, MessageCircle, MoreHorizontal, Pencil, Phone, PhoneCall, RotateCcw, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmAction } from "@/components/app/confirm-action";
import { AssignFollowupDialog, type Worker } from "@/features/followups/assign-dialog";
import { addMembersToDepartment, setMembersStatus } from "@/features/members/actions";
import { useAction } from "@/hooks/use-action";

export function MemberProfileActions({
  memberId,
  name,
  status,
  tel,
  whatsapp,
  canManage,
  canAssign,
  canDepartments,
  workers,
  departments,
  today,
}: {
  memberId: string;
  name: string;
  status: string;
  tel: string | null;
  whatsapp: string | null;
  canManage: boolean;
  canAssign: boolean;
  canDepartments: boolean;
  workers: Worker[];
  departments: { id: string; name: string }[];
  today: string;
}) {
  const [assign, setAssign] = React.useState(false);
  const dept = useAction(addMembersToDepartment);
  const restore = useAction(setMembersStatus);
  return (
    <div className="flex flex-wrap gap-2">
      {tel && (
        <Button asChild variant="outline" size="sm">
          <a href={tel}>
            <Phone /> Call
          </a>
        </Button>
      )}
      {whatsapp && (
        <Button asChild variant="outline" size="sm">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> WhatsApp
          </a>
        </Button>
      )}
      {canAssign && (
        <Button variant="outline" size="sm" onClick={() => setAssign(true)}>
          <PhoneCall /> Assign follow-up
        </Button>
      )}
      {canManage && (
        <Button asChild size="sm">
          <Link href={`/members/${memberId}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      )}
      {(canManage || canDepartments) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {canDepartments && departments.length > 0 && (
              <>
                <DropdownMenuLabel>
                  <UsersRound className="mr-1 inline size-3.5" /> Add to department
                </DropdownMenuLabel>
                {departments.map((d) => (
                  <DropdownMenuItem key={d.id} disabled={dept.pending} onSelect={() => dept.run([memberId], d.id)}>
                    {d.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            {canManage && status === "archived" && (
              <DropdownMenuItem onSelect={() => restore.run([memberId], "active")}>
                <RotateCcw /> Restore as active
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {canManage && status !== "archived" && (
        <ConfirmAction
          trigger={
            <Button variant="ghost" size="sm" className="text-destructive">
              <Archive /> Archive
            </Button>
          }
          title={`Archive ${name}?`}
          description="They will be hidden from lists and reports. Attendance, giving and follow-up history is kept and they can be restored later."
          confirmLabel="Archive"
          destructive
          action={() => setMembersStatus([memberId], "archived")}
        />
      )}
      {canAssign && <AssignFollowupDialog open={assign} onOpenChange={setAssign} workers={workers} memberIds={[memberId]} today={today} title={`Assign follow-up for ${name}`} />}
    </div>
  );
}
