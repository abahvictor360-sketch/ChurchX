"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { nativeSelect } from "@/features/members/member-form";
import { saveVisitor } from "@/features/visitors/actions";
import type { Tables } from "@/types/database";

const HEARD = ["Friend or family", "Social media", "Walked in", "Flyer / poster", "Radio / TV", "Website", "Outreach / evangelism", "Other"];

type Visitor = Partial<Tables<"visitors">>;

/** Mobile-first: large inputs, required fields first, optional fields collapsed. */
export function VisitorForm({
  visitor,
  services,
  today,
  defaultServiceId,
}: {
  visitor?: Visitor;
  services: { id: string; name: string; service_date: string }[];
  today: string;
  defaultServiceId?: string;
}) {
  const [state, action] = useActionState(saveVisitor.bind(null, visitor?.id ?? null), null);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  const d = visitor ?? {};
  const savedName = state?.ok ? state.message : null;

  if (state?.ok && savedName && !visitor?.id) {
    return (
      <div className="grid gap-4 rounded-lg border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
        <p className="text-lg font-semibold" role="status">
          {savedName}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {/* Full reload resets the form state for the next visitor. */}
          <Button size="xl" onClick={() => window.location.reload()}>
            <UserPlus /> Register another
          </Button>
          {state.ok && state.data?.id && (
            <Button size="xl" variant="outline" asChild>
              <Link href={`/visitors/${state.data.id}`}>View visitor</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
      {fe("duplicate") && (
        <div role="alert" className="grid gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" /> {fe("duplicate")}
          </p>
          <div className="flex items-center gap-2">
            <Checkbox id="confirm_duplicate" name="confirm_duplicate" />
            <Label htmlFor="confirm_duplicate">Register anyway</Label>
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="first_name" required error={fe("first_name")}>
          <Input name="first_name" defaultValue={d.first_name ?? ""} autoComplete="given-name" className="h-12 text-base" autoFocus={!visitor} />
        </Field>
        <Field label="Last name" htmlFor="last_name" error={fe("last_name")}>
          <Input name="last_name" defaultValue={d.last_name ?? ""} autoComplete="family-name" className="h-12 text-base" />
        </Field>
      </div>
      <Field label="Phone number" htmlFor="phone" error={fe("phone")} hint="Needed for follow-up calls and WhatsApp">
        <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={d.phone ?? ""} className="h-12 text-base" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service attended" htmlFor="service_id" error={fe("service_id")}>
          <select name="service_id" defaultValue={d.service_id ?? defaultServiceId ?? ""} className={`${nativeSelect} h-12 text-base`}>
            <option value="">Not linked to a service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.service_date}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date of visit" htmlFor="visit_date" required error={fe("visit_date")}>
          <Input name="visit_date" type="date" defaultValue={d.visit_date ?? today} max={today} className="h-12 text-base" />
        </Field>
      </div>
      <Field label="Gender" htmlFor="gender" error={fe("gender")}>
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {[
            ["", "Skip"],
            ["male", "Male"],
            ["female", "Female"],
          ].map(([value, label]) => (
            <label key={value} className="flex h-12 cursor-pointer items-center justify-center rounded-md border bg-card text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
              <input type="radio" name="gender" value={value} defaultChecked={(d.gender ?? "") === value} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </Field>

      <details className="group rounded-lg border bg-card p-4" open={Boolean(visitor)}>
        <summary className="cursor-pointer text-sm font-semibold select-none">More details (optional)</summary>
        <div className="mt-4 grid gap-4">
          <Field label="Email" htmlFor="email" error={fe("email")}>
            <Input name="email" type="email" inputMode="email" defaultValue={d.email ?? ""} />
          </Field>
          <Field label="Address" htmlFor="address" error={fe("address")}>
            <Input name="address" defaultValue={d.address ?? ""} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="How did they hear about us?" htmlFor="heard_about" error={fe("heard_about")}>
              <select name="heard_about" defaultValue={d.heard_about ?? ""} className={nativeSelect}>
                <option value="">Not specified</option>
                {HEARD.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </Field>
            <Field label="Invited by" htmlFor="invited_by" error={fe("invited_by")}>
              <Input name="invited_by" defaultValue={d.invited_by ?? ""} placeholder="Name of person who invited them" />
            </Field>
          </div>
          <Field label="Prayer request / notes" htmlFor="prayer_request" error={fe("prayer_request")}>
            <Textarea name="prayer_request" rows={3} defaultValue={d.prayer_request ?? ""} />
          </Field>
        </div>
      </details>

      <div className="sticky bottom-20 z-10 grid gap-2 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur sm:flex sm:justify-end lg:bottom-4">
        <SubmitButton size="xl" className="w-full sm:w-auto" pendingText="Saving…">
          {visitor?.id ? "Save changes" : "Register visitor"}
        </SubmitButton>
      </div>
    </form>
  );
}
