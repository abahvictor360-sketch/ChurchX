"use client";

import * as React from "react";
import { useActionState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { PersonPicker } from "@/components/app/person-picker";
import { nativeSelect } from "@/features/members/member-form";
import { addDepartmentMember, saveDepartment } from "@/features/departments/actions";
import { useAction, useActionToast } from "@/hooks/use-action";
import type { PersonOption } from "@/features/people/actions";

export function DepartmentDialog({
  department,
}: {
  department?: { id: string; name: string; description: string | null; status: string; leader?: PersonOption | null; assistant?: PersonOption | null };
}) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = useActionState(saveDepartment.bind(null, department?.id ?? null), null);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  useActionToast(state, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {department ? (
          <Button variant="outline" size="sm">
            <Pencil /> Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> New department
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{department ? "Edit department" : "New department"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
          <Field label="Name" htmlFor="name" required error={fe("name")}>
            <Input name="name" defaultValue={department?.name ?? ""} placeholder="e.g. Choir, Ushers, Media" />
          </Field>
          <Field label="Description" htmlFor="description" error={fe("description")}>
            <Textarea name="description" rows={2} defaultValue={department?.description ?? ""} />
          </Field>
          <Field label="Leader" htmlFor="leader_member_id" error={fe("leader_member_id")} hint="Link a staff account to this member to give them department-leader access">
            <PersonPicker name="leader_member_id" kind="member" defaultValue={department?.leader ?? null} />
          </Field>
          <Field label="Assistant leader" htmlFor="assistant_member_id" error={fe("assistant_member_id")}>
            <PersonPicker name="assistant_member_id" kind="member" defaultValue={department?.assistant ?? null} />
          </Field>
          <Field label="Status" htmlFor="status">
            <select name="status" defaultValue={department?.status ?? "active"} className={nativeSelect}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>{department ? "Save" : "Create"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddDepartmentMember({ departmentId }: { departmentId: string }) {
  const [value, setValue] = React.useState<PersonOption | null>(null);
  const [pickerKey, setPickerKey] = React.useState(0);
  const { run, pending } = useAction(addDepartmentMember, {
    onSuccess: () => {
      setValue(null);
      setPickerKey((k) => k + 1);
    },
  });
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex-1">
        <PersonPicker key={pickerKey} kind="member" onChange={setValue} placeholder="Add a member…" />
      </div>
      <Button disabled={!value || pending} onClick={() => value && run(departmentId, value.id)}>
        <Plus /> Add
      </Button>
    </div>
  );
}
