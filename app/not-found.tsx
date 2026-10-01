import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shell/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo />
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-sm text-muted-foreground">The page you are looking for does not exist.</p>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
