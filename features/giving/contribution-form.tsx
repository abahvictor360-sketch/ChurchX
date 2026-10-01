"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { PersonPicker } from "@/components/app/person-picker";
import { nativeSelect } from "@/features/members/member-form";
import { saveContribution } from "@/features/giving/actions";
import { useActionToast } from "@/hooks/use-action";
import { PAYMENT_METHODS } from "@/lib/validation";
import { titleCase } from "@/lib/format";
import type { PersonOption } from "@/features/people/actions";

export type ContributionDefaults = {
  id?: string;
  member?: PersonOption | null;
  is_anonymous?: boolean;
  contributor_name?: string | null;
  category_id?: string;
  amount?: number;
  contribution_date?: string;
  payment_method?: string;
  reference?: string | null;
  notes?: string | null;
};

export function ContributionForm({
  categories,
  currency,
  today,
  defaults,
}: {
  categories: { id: string; name: string }[];
  currency: string;
  today: string;
  defaults?: ContributionDefaults;
}) {
  const router = useRouter();
  const [state, action] = useActionState(saveContribution.bind(null, defaults?.id ?? null), null);
  const [anonymous, setAnonymous] = React.useState(Boolean(defaults?.is_anonymous));
  const [member, setMember] = React.useState<PersonOption | null>(defaults?.member ?? null);
  const [formKey, setFormKey] = React.useState(0);
  const another = React.useRef(false);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  useActionToast(state, () => {
    if (defaults?.id || !another.current) router.push("/giving");
    else {
      setFormKey((k) => k + 1);
      setMember(null);
      setAnonymous(false);
    }
  });

  return (
    <Card>
      <CardContent>
        <form key={formKey} action={action} className="grid gap-4" noValidate>
          <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Amount (${currency})`} htmlFor="amount" required error={fe("amount")}>
              <Input name="amount" inputMode="decimal" defaultValue={defaults?.amount ?? ""} placeholder="0.00" className="h-12 text-lg font-semibold" autoFocus />
            </Field>
            <Field label="Category" htmlFor="category_id" required error={fe("category_id")}>
              <select name="category_id" defaultValue={defaults?.category_id ?? categories[0]?.id ?? ""} className={`${nativeSelect} h-12`}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Checkbox id="is_anonymous" name="is_anonymous" checked={anonymous} onCheckedChange={(c) => setAnonymous(c === true)} />
              <Label htmlFor="is_anonymous">Anonymous gift</Label>
            </div>
            {!anonymous && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Member" htmlFor="member_id" error={fe("member_id")}>
                  <PersonPicker name="member_id" kind="member" defaultValue={member} onChange={setMember} />
                </Field>
                {!member && (
                  <Field label="Or contributor name" htmlFor="contributor_name" error={fe("contributor_name")} hint="For non-members">
                    <Input name="contributor_name" defaultValue={defaults?.contributor_name ?? ""} />
                  </Field>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date" htmlFor="contribution_date" required error={fe("contribution_date")}>
              <Input type="date" name="contribution_date" max={today} defaultValue={defaults?.contribution_date ?? today} />
            </Field>
            <Field label="Payment method" htmlFor="payment_method" required error={fe("payment_method")}>
              <select name="payment_method" defaultValue={defaults?.payment_method ?? "cash"} className={nativeSelect}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m === "pos" ? "POS" : titleCase(m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reference" htmlFor="reference" error={fe("reference")} hint="Teller, transfer or receipt no.">
              <Input name="reference" defaultValue={defaults?.reference ?? ""} />
            </Field>
          </div>
          <Field label="Notes" htmlFor="notes" error={fe("notes")}>
            <Textarea name="notes" rows={2} defaultValue={defaults?.notes ?? ""} />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button asChild variant="ghost">
              <Link href="/giving">Cancel</Link>
            </Button>
            {!defaults?.id && (
              <SubmitButton variant="outline" onClick={() => (another.current = true)}>
                Save &amp; add another
              </SubmitButton>
            )}
            <SubmitButton onClick={() => (another.current = false)}>{defaults?.id ? "Save changes" : "Record contribution"}</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
