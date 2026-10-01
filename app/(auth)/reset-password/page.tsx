import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/context";
import { ResetForm } from "@/features/auth/forms";

export const metadata = { title: "Choose a password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const user = await getUser();
  if (!user) redirect("/login?error=link");
  const { welcome } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-bold">{welcome ? "Welcome to ChurchX" : "Choose a new password"}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {welcome ? "You've been invited to join your church's team. Set a password to activate your account." : `Signed in as ${user.email}.`}
      </p>
      <ResetForm />
    </>
  );
}
