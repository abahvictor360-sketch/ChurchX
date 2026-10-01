"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { saveMember } from "@/features/members/actions";
import { MARITAL, MEMBER_STATUSES } from "@/lib/validation";
import { titleCase } from "@/lib/format";
import type { Tables } from "@/types/database";

export const nativeSelect =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-destructive sm:h-9 sm:text-sm";

type Member = Partial<Tables<"members">>;

export function MemberForm({ member, defaultCountry, today }: { member?: Member; defaultCountry?: string | null; today: string }) {
  const action = saveMember.bind(null, member?.id ?? null);
  const [state, formAction] = useActionState(action, null);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  const duplicate = fe("duplicate");
  const d = member ?? {};

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormError message={state && !state.ok && !state.fieldErrors ? state.error : state && !state.ok && !duplicate ? state.error : null} />
      {duplicate && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" aria-hidden /> Possible duplicate
          </p>
          <p>{duplicate}</p>
          <div className="flex items-center gap-2">
            <Checkbox id="confirm_duplicate" name="confirm_duplicate" />
            <Label htmlFor="confirm_duplicate">This is a different person — save anyway</Label>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="First name" htmlFor="first_name" required error={fe("first_name")}>
            <Input name="first_name" defaultValue={d.first_name ?? ""} autoComplete="given-name" />
          </Field>
          <Field label="Middle name" htmlFor="middle_name" error={fe("middle_name")}>
            <Input name="middle_name" defaultValue={d.middle_name ?? ""} autoComplete="additional-name" />
          </Field>
          <Field label="Last name" htmlFor="last_name" required error={fe("last_name")}>
            <Input name="last_name" defaultValue={d.last_name ?? ""} autoComplete="family-name" />
          </Field>
          <Field label="Gender" htmlFor="gender" error={fe("gender")}>
            <select name="gender" defaultValue={d.gender ?? ""} className={nativeSelect}>
              <option value="">Not specified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Date of birth" htmlFor="date_of_birth" error={fe("date_of_birth")}>
            <Input name="date_of_birth" type="date" max={today} defaultValue={d.date_of_birth ?? ""} />
          </Field>
          <Field label="Marital status" htmlFor="marital_status" error={fe("marital_status")}>
            <select name="marital_status" defaultValue={d.marital_status ?? ""} className={nativeSelect}>
              <option value="">Not specified</option>
              {MARITAL.map((m) => (
                <option key={m} value={m}>
                  {titleCase(m)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Occupation" htmlFor="occupation" error={fe("occupation")} className="sm:col-span-3">
            <Input name="occupation" defaultValue={d.occupation ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="phone" error={fe("phone")} hint="Local numbers like 0803… are converted automatically">
            <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={d.phone ?? ""} />
          </Field>
          <Field label="Email" htmlFor="email" error={fe("email")}>
            <Input name="email" type="email" inputMode="email" autoComplete="email" defaultValue={d.email ?? ""} />
          </Field>
          <Field label="Address" htmlFor="address" error={fe("address")} className="sm:col-span-2">
            <Input name="address" defaultValue={d.address ?? ""} autoComplete="street-address" />
          </Field>
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
            <Field label="City" htmlFor="city" error={fe("city")}>
              <Input name="city" defaultValue={d.city ?? ""} />
            </Field>
            <Field label="State" htmlFor="state" error={fe("state")}>
              <Input name="state" defaultValue={d.state ?? ""} />
            </Field>
            <Field label="Country" htmlFor="country" error={fe("country")}>
              <Input name="country" defaultValue={d.country ?? defaultCountry ?? ""} />
            </Field>
          </div>
          <Field label="Emergency contact name" htmlFor="emergency_contact_name" error={fe("emergency_contact_name")}>
            <Input name="emergency_contact_name" defaultValue={d.emergency_contact_name ?? ""} />
          </Field>
          <Field label="Emergency contact phone" htmlFor="emergency_contact_phone" error={fe("emergency_contact_phone")}>
            <Input name="emergency_contact_phone" type="tel" inputMode="tel" defaultValue={d.emergency_contact_phone ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membership</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Membership status" htmlFor="membership_status" required error={fe("membership_status")}>
            <select name="membership_status" defaultValue={d.membership_status ?? "new_member"} className={nativeSelect}>
              {MEMBER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Join date" htmlFor="join_date" required error={fe("join_date")}>
            <Input name="join_date" type="date" defaultValue={d.join_date ?? today} />
          </Field>
          <Field label="Membership number" htmlFor="membership_number" error={fe("membership_number")} hint={member?.id ? undefined : "Leave blank to generate automatically"}>
            <Input name="membership_number" defaultValue={d.membership_number ?? ""} />
          </Field>
          <Field label="Notes" htmlFor="notes" error={fe("notes")} className="sm:col-span-3" hint="General notes visible to staff who can view members. Use confidential notes on the profile for sensitive matters.">
            <Textarea name="notes" rows={3} defaultValue={d.notes ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-10 flex justify-end gap-2 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur lg:bottom-4">
        <Button asChild variant="ghost">
          <Link href={member?.id ? `/members/${member.id}` : "/members"}>Cancel</Link>
        </Button>
        <SubmitButton>{member?.id ? "Save changes" : "Add member"}</SubmitButton>
      </div>
    </form>
  );
}
