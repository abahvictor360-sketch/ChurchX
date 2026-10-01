import Link from "next/link";
import { LoginForm } from "@/features/auth/forms";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <>
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Sign in to manage your church.</p>
      <LoginForm next={next} linkError={sp.error === "link"} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New church?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
