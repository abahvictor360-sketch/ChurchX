"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/features/auth/actions";
import type { ActionResult } from "@/lib/actions";

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-10" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function Success({ message }: { message: string }) {
  return (
    <div role="status" className="flex gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
      <MailCheck className="size-5 shrink-0" aria-hidden />
      {message}
    </div>
  );
}

const fe = (s: ActionResult | null, k: string) => (s && !s.ok ? s.fieldErrors?.[k] : undefined);
const formErr = (s: ActionResult | null) => (s && !s.ok && !s.fieldErrors ? s.error : null);

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [state, action] = useActionState(signIn, null);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      {linkError && <FormError message="That link is invalid or has expired. Please request a new one." />}
      <FormError message={formErr(state)} />
      <Field label="Email" htmlFor="email" required error={fe(state, "email")}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label="Password" htmlFor="password" required error={fe(state, "password")}>
        <PasswordInput name="password" autoComplete="current-password" required />
      </Field>
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          Forgot password?
        </Link>
      </div>
      <SubmitButton size="lg" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(signUp, null);
  if (state?.ok && state.message) return <Success message={state.message} />;
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError message={formErr(state)} />
      <Field label="Your full name" htmlFor="full_name" required error={fe(state, "full_name")}>
        <Input name="full_name" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email" required error={fe(state, "email")}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label="Password" htmlFor="password" required error={fe(state, "password")} hint="At least 8 characters with a letter and a number.">
        <PasswordInput name="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton size="lg" pendingText="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-xs text-muted-foreground">
        You&apos;ll set up your church right after confirming your email. Church members don&apos;t need accounts — only staff who use ChurchX.
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  if (state?.ok && state.message) return <Success message={state.message} />;
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError message={formErr(state)} />
      <Field label="Email" htmlFor="email" required error={fe(state, "email")}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <SubmitButton size="lg" pendingText="Sending…">
        Send reset link
      </SubmitButton>
      <Button asChild variant="ghost">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </form>
  );
}

export function ResetForm() {
  const [state, action] = useActionState(updatePassword, null);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError message={formErr(state)} />
      <Field label="New password" htmlFor="password" required error={fe(state, "password")} hint="At least 8 characters with a letter and a number.">
        <PasswordInput name="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" required error={fe(state, "confirm")}>
        <PasswordInput name="confirm" autoComplete="new-password" required />
      </Field>
      <SubmitButton size="lg" pendingText="Saving…">
        Save password
      </SubmitButton>
    </form>
  );
}
