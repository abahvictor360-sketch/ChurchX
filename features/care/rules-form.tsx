"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { updateCareRules } from "@/features/church/actions";
import { useActionToast } from "@/hooks/use-action";

const RULES: { key: string; label: string; hint: string; min: number; max: number }[] = [
  { key: "absent_consecutive", label: "Flag after missing this many services in a row", hint: "Default 2", min: 1, max: 20 },
  { key: "absent_long", label: "Treat as a long absence after", hint: "Default 4 services", min: 2, max: 52 },
  { key: "visitor_contact_days", label: "Flag visitors not contacted after (days)", hint: "Default 2", min: 0, max: 30 },
  { key: "attendance_drop_pct", label: "Flag when attendance drops by (%)", hint: "Compares the last 4 weeks to the 8 weeks before. Default 50", min: 10, max: 100 },
  { key: "birthday_lookahead_days", label: "Show upcoming birthdays within (days)", hint: "Default 7", min: 1, max: 31 },
  { key: "no_department_after_days", label: "Flag new members without a department after (days)", hint: "Default 14", min: 0, max: 365 },
];

export function CareRulesForm({ rules }: { rules: Record<string, number> }) {
  const [state, action] = useActionState(updateCareRules, null);
  useActionToast(state);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  return (
    <form action={action} className="grid gap-4">
      <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
      <div className="grid gap-4 sm:grid-cols-2">
        {RULES.map((r) => (
          <Field key={r.key} label={r.label} htmlFor={r.key} required error={fe(r.key)} hint={r.hint}>
            <Input name={r.key} type="number" inputMode="numeric" min={r.min} max={r.max} defaultValue={rules[r.key] ?? ""} />
          </Field>
        ))}
      </div>
      <SubmitButton className="w-fit">Save rules</SubmitButton>
    </form>
  );
}
