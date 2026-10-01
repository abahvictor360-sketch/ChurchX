import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/shell/logo";
import { isSupabaseConfigured } from "@/lib/env";
import { SetupNotice } from "@/components/app/setup-notice";

const POINTS = [
  "Register visitors in seconds from your phone",
  "Never lose track of a first-timer — assign and record follow-ups",
  "Spot members who need care before they drift away",
  "Fast Sunday check-in, giving records and clear reports",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-secondary p-10 text-secondary-foreground lg:flex lg:flex-col">
        <div className="absolute -top-24 -right-24 size-80 rounded-full bg-primary/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
            <Logo className="text-white [&_span.text-primary]:text-orange-300" />
          </span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl leading-tight font-bold">Shepherd every person, not just the records.</h2>
          <ul className="mt-6 space-y-3 text-sm text-white/85">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-orange-300" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
