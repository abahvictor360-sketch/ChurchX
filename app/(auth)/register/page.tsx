import Link from "next/link";
import { RegisterForm } from "@/features/auth/forms";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Set up ChurchX for your church</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Create the administrator account. You can invite your team afterwards.</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
