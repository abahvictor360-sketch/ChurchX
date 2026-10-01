"use client";

import * as React from "react";
import { useActionState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { nativeSelect } from "@/features/members/member-form";
import { saveService } from "@/features/services/actions";
import { useActionToast } from "@/hooks/use-action";
import { SERVICE_STATUSES } from "@/lib/validation";
import { titleCase } from "@/lib/format";
import type { Tables } from "@/types/database";

type ServiceType = Pick<Tables<"service_types">, "id" | "name" | "default_start_time" | "default_end_time">;

export function ServiceDialog({
  service,
  types,
  today,
  autoOpen,
}: {
  service?: Partial<Tables<"services">>;
  types: ServiceType[];
  today: string;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = React.useState(Boolean(autoOpen));
  const [state, action] = useActionState(saveService.bind(null, service?.id ?? null), null);
  const [typeId, setTypeId] = React.useState(service?.service_type_id ?? "");
  const [name, setName] = React.useState(service?.name ?? "");
  const [start, setStart] = React.useState(service?.start_time?.slice(0, 5) ?? "");
  const [end, setEnd] = React.useState(service?.end_time?.slice(0, 5) ?? "");
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o && params.get("new")) router.replace(pathname);
  };
  useActionToast(state, () => onOpenChange(false));

  const pickType = (id: string) => {
    setTypeId(id);
    const t = types.find((x) => x.id === id);
    if (t) {
      if (!name) setName(t.name);
      if (!start && t.default_start_time) setStart(t.default_start_time.slice(0, 5));
      if (!end && t.default_end_time) setEnd(t.default_end_time.slice(0, 5));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {service?.id ? (
          <Button variant="outline" size="sm">
            <Pencil /> Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> New service
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{service?.id ? "Edit service" : "Schedule a service"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
          <Field label="Service type" htmlFor="service_type_id" error={fe("service_type_id")}>
            <select name="service_type_id" value={typeId} onChange={(e) => pickType(e.target.value)} className={nativeSelect}>
              <option value="">No type</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Service name" htmlFor="name" required error={fe("name")}>
            <Input name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunday First Service" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date" htmlFor="service_date" required error={fe("service_date")} className="col-span-3 sm:col-span-1">
              <Input type="date" name="service_date" defaultValue={service?.service_date ?? today} />
            </Field>
            <Field label="Start" htmlFor="start_time" error={fe("start_time")}>
              <Input type="time" name="start_time" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="End" htmlFor="end_time" error={fe("end_time")}>
              <Input type="time" name="end_time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Location" htmlFor="location" error={fe("location")}>
              <Input name="location" defaultValue={service?.location ?? ""} placeholder="Main auditorium" />
            </Field>
            <Field label="Status" htmlFor="status" error={fe("status")}>
              <select name="status" defaultValue={service?.status ?? "scheduled"} className={nativeSelect}>
                {SERVICE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {titleCase(s)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Notes" htmlFor="notes" error={fe("notes")}>
            <Textarea name="notes" rows={2} defaultValue={service?.notes ?? ""} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton>{service?.id ? "Save" : "Schedule"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
