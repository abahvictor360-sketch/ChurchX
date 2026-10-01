"use client";

import * as React from "react";
import { useActionState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { nativeSelect } from "@/features/members/member-form";
import { saveCategory } from "@/features/giving/actions";
import { saveServiceType, toggleServiceType } from "@/features/services/actions";
import { useAction, useActionToast } from "@/hooks/use-action";
import { WEEKDAYS } from "@/lib/locales";

export function CategoryDialog({ category }: { category?: { id: string; name: string; description: string | null; is_active: boolean } }) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = useActionState(saveCategory.bind(null, category?.id ?? null), null);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  useActionToast(state, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {category ? (
          <Button variant="ghost" size="sm">
            <Pencil /> Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> Add category
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "New giving category"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
          <Field label="Name" htmlFor="name" required error={fe("name")}>
            <Input name="name" defaultValue={category?.name ?? ""} />
          </Field>
          <Field label="Description" htmlFor="description" error={fe("description")}>
            <Input name="description" defaultValue={category?.description ?? ""} />
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox id="cat-active" name="is_active" defaultChecked={category?.is_active ?? true} />
            <Label htmlFor="cat-active">Active (available when recording contributions)</Label>
          </div>
          <DialogFooter>
            <SubmitButton>Save</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ServiceType = {
  id: string;
  name: string;
  description: string | null;
  default_day: number | null;
  default_start_time: string | null;
  default_end_time: string | null;
  include_in_care: boolean;
  is_active: boolean;
};

export function ServiceTypeDialog({ type }: { type?: ServiceType }) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = useActionState(saveServiceType.bind(null, type?.id ?? null), null);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  useActionToast(state, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {type ? (
          <Button variant="ghost" size="sm">
            <Pencil /> Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> Add service type
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type ? "Edit service type" : "New service type"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
          <Field label="Name" htmlFor="name" required error={fe("name")}>
            <Input name="name" defaultValue={type?.name ?? ""} />
          </Field>
          <Field label="Description" htmlFor="description" error={fe("description")}>
            <Input name="description" defaultValue={type?.description ?? ""} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Usual day" htmlFor="default_day" error={fe("default_day")}>
              <select name="default_day" defaultValue={type?.default_day ?? ""} className={nativeSelect}>
                <option value="">None</option>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start" htmlFor="default_start_time" error={fe("default_start_time")}>
              <Input type="time" name="default_start_time" defaultValue={type?.default_start_time?.slice(0, 5) ?? ""} />
            </Field>
            <Field label="End" htmlFor="default_end_time" error={fe("default_end_time")}>
              <Input type="time" name="default_end_time" defaultValue={type?.default_end_time?.slice(0, 5) ?? ""} />
            </Field>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="include_in_care" name="include_in_care" defaultChecked={type?.include_in_care ?? true} className="mt-0.5" />
            <Label htmlFor="include_in_care" className="leading-snug">
              Count for absence alerts
              <span className="block text-xs font-normal text-muted-foreground">Turn off for optional meetings (vigils, special programmes) so missing them doesn&apos;t flag members.</span>
            </Label>
          </div>
          <DialogFooter>
            <SubmitButton>Save</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ToggleServiceType({ id, active }: { id: string; active: boolean }) {
  const { run, pending } = useAction(toggleServiceType);
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(id, !active)}>
      {active ? "Disable" : "Enable"}
    </Button>
  );
}
