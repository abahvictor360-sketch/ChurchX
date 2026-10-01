"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { changePassword, updateProfile } from "@/features/users/actions";
import { useActionToast } from "@/hooks/use-action";

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string; email: string }) {
  const [state, action] = useActionState(updateProfile, null);
  useActionToast(state);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  return (
    <form action={action} className="grid gap-4">
      <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
      <Field label="Email" htmlFor="email" hint="Contact your administrator to change your sign-in email">
        <Input value={email} disabled readOnly />
      </Field>
      <Field label="Full name" htmlFor="full_name" required error={fe("full_name")}>
        <Input name="full_name" defaultValue={fullName} autoComplete="name" />
      </Field>
      <Field label="Phone" htmlFor="phone" error={fe("phone")}>
        <Input name="phone" type="tel" defaultValue={phone} autoComplete="tel" />
      </Field>
      <SubmitButton className="w-fit">Save profile</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, null);
  useActionToast(state);
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  return (
    <form action={action} className="grid gap-4">
      <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
      <Field label="New password" htmlFor="password" required error={fe("password")} hint="At least 8 characters with a letter and a number">
        <Input name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" required error={fe("confirm")}>
        <Input name="confirm" type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton className="w-fit">Change password</SubmitButton>
    </form>
  );
}
