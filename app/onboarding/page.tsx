import { redirect } from "next/navigation";
import { getChurchContext, requireUser } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/env";
import { Logo } from "@/components/shell/logo";
import { SetupNotice } from "@/components/app/setup-notice";
import { OnboardingWizard } from "@/features/church/onboarding-wizard";

export const metadata = { title: "Set up your church" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  await requireUser();
  const { new: createAnother } = await searchParams;
  const ctx = await getChurchContext();
  if (ctx?.church.onboarding_completed_at && !createAnother) redirect("/dashboard");
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-8 sm:py-14">
      <Logo />
      <h1 className="mt-8 text-2xl font-bold">Let&apos;s set up your church</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">This takes about two minutes. Only the church name is required.</p>
      <OnboardingWizard />
    </main>
  );
}
