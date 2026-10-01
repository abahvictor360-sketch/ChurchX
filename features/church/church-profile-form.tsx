"use client";

import * as React from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { nativeSelect } from "@/features/members/member-form";
import { updateChurchProfile, updateMemberPrefix, updateServiceDays } from "@/features/church/actions";
import { useAction, useActionToast } from "@/hooks/use-action";
import { COMMON_TIMEZONES, COUNTRIES, WEEKDAYS } from "@/lib/locales";
import { CURRENCIES } from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

export function ChurchProfileForm({ church }: { church: Tables<"churches"> }) {
  const [state, action] = useActionState(updateChurchProfile, null);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  useActionToast(state);
  const zones = React.useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return COMMON_TIMEZONES;
    }
  }, []);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
      <Field label="Church name" htmlFor="name" required error={fe("name")}>
        <Input name="name" defaultValue={church.name} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Country" htmlFor="country" error={fe("country")}>
          <Input name="country" defaultValue={church.country ?? ""} list="countries" />
        </Field>
        <Field label="State / region" htmlFor="state" error={fe("state")}>
          <Input name="state" defaultValue={church.state ?? ""} />
        </Field>
        <Field label="City" htmlFor="city" error={fe("city")}>
          <Input name="city" defaultValue={church.city ?? ""} />
        </Field>
      </div>
      <datalist id="countries">
        {COUNTRIES.map((c) => (
          <option key={c.name} value={c.name} />
        ))}
      </datalist>
      <Field label="Address" htmlFor="address" error={fe("address")}>
        <Textarea name="address" rows={2} defaultValue={church.address ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Phone" htmlFor="phone" error={fe("phone")}>
          <Input name="phone" type="tel" defaultValue={church.phone ?? ""} />
        </Field>
        <Field label="Email" htmlFor="email" error={fe("email")}>
          <Input name="email" type="email" defaultValue={church.email ?? ""} />
        </Field>
        <Field label="Website" htmlFor="website" error={fe("website")}>
          <Input name="website" type="url" defaultValue={church.website ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Timezone" htmlFor="timezone" required error={fe("timezone")} hint="Used for 'today', birthdays and reports">
          <select name="timezone" defaultValue={church.timezone} className={nativeSelect}>
            {zones.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </Field>
        <Field label="Currency" htmlFor="currency" required error={fe("currency")} hint="Existing contributions keep the currency they were recorded in">
          <select name="currency" defaultValue={church.currency} className={nativeSelect}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton>Save church profile</SubmitButton>
      </div>
    </form>
  );
}

export function ServiceDaysEditor({ initial }: { initial: number[] }) {
  const [days, setDays] = React.useState(initial);
  const { run, pending } = useAction(updateServiceDays);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Default service days">
        {WEEKDAYS.map((d, i) => {
          const on = days.includes(i);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => setDays((p) => (on ? p.filter((x) => x !== i) : [...p, i]))}
              className={cn("h-10 rounded-md border px-3 text-sm", on ? "border-primary bg-accent font-medium text-primary" : "bg-card")}
            >
              {d.slice(0, 3)}
            </button>
          );
        })}
      </div>
      <Button className="w-fit" variant="outline" disabled={pending} onClick={() => run(days)}>
        Save service days
      </Button>
    </div>
  );
}

export function MemberPrefixEditor({ initial }: { initial: string }) {
  const [value, setValue] = React.useState(initial);
  const { run, pending } = useAction(updateMemberPrefix);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1.5">
        <label htmlFor="prefix" className="text-sm font-medium">
          Membership number prefix
        </label>
        <Input id="prefix" value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} maxLength={8} className="w-32" />
      </div>
      <Button variant="outline" disabled={pending} onClick={() => run(value)}>
        Save
      </Button>
      <p className="w-full text-xs text-muted-foreground">New members get numbers like {value || "CX"}-00042.</p>
    </div>
  );
}
