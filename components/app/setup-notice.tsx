import { Logo } from "@/components/shell/logo";

export function SetupNotice() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-lg rounded-lg border bg-card p-8 shadow-sm">
        <Logo />
        <h1 className="mt-6 text-xl font-bold">Supabase is not configured</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Copy <code className="rounded bg-muted px-1">.env.example</code> to <code className="rounded bg-muted px-1">.env.local</code>, add your
          Supabase project URL and publishable key, apply the migrations in <code className="rounded bg-muted px-1">supabase/migrations</code>, then
          restart the server. See the README for step-by-step instructions.
        </p>
      </div>
    </main>
  );
}
