import { ForgotForm } from "@/features/auth/forms";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Forgot your password?</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <ForgotForm />
    </>
  );
}
