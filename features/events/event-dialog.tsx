"use client";

import * as React from "react";
import { useActionState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { nativeSelect } from "@/features/members/member-form";
import { saveEvent } from "@/features/events/actions";
import { useActionToast } from "@/hooks/use-action";
import type { Tables } from "@/types/database";

export function EventDialog({ event, today }: { event?: Tables<"events">; today: string }) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = useActionState(saveEvent.bind(null, event?.id ?? null), null);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  useActionToast(state, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {event ? (
          <Button variant="outline" size="sm">
            <Pencil /> Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> New event
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
          <Field label="Event name" htmlFor="name" required error={fe("name")}>
            <Input name="name" defaultValue={event?.name ?? ""} placeholder="e.g. Annual Convention 2026" />
          </Field>
          <Field label="Description" htmlFor="description" error={fe("description")}>
            <Textarea name="description" rows={3} defaultValue={event?.description ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" htmlFor="start_date" required error={fe("start_date")}>
              <Input type="date" name="start_date" defaultValue={event?.start_date ?? today} />
            </Field>
            <Field label="End date" htmlFor="end_date" required error={fe("end_date")}>
              <Input type="date" name="end_date" defaultValue={event?.end_date ?? today} />
            </Field>
            <Field label="Start time" htmlFor="start_time" error={fe("start_time")}>
              <Input type="time" name="start_time" defaultValue={event?.start_time?.slice(0, 5) ?? ""} />
            </Field>
            <Field label="End time" htmlFor="end_time" error={fe("end_time")}>
              <Input type="time" name="end_time" defaultValue={event?.end_time?.slice(0, 5) ?? ""} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Venue" htmlFor="venue" error={fe("venue")}>
              <Input name="venue" defaultValue={event?.venue ?? ""} />
            </Field>
            <Field label="Capacity" htmlFor="capacity" error={fe("capacity")} hint="Leave empty for unlimited">
              <Input type="number" name="capacity" min={1} inputMode="numeric" defaultValue={event?.capacity ?? ""} />
            </Field>
            <Field label="Registration" htmlFor="registration_status">
              <select name="registration_status" defaultValue={event?.registration_status ?? "open"} className={nativeSelect}>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
            <Field label="Status" htmlFor="status">
              <select name="status" defaultValue={event?.status ?? "scheduled"} className={nativeSelect}>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>{event ? "Save" : "Create event"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
