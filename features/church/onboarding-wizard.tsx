"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form-field";
import { createChurch, completeOnboarding } from "@/features/church/actions";
import { LogoUploader } from "@/features/church/logo-uploader";
import { COMMON_TIMEZONES, COUNTRIES, NIGERIAN_STATES, WEEKDAYS } from "@/lib/locales";
import { CURRENCIES } from "@/lib/validation";
import { cn } from "@/lib/utils";

const STEPS = ["Church details", "Contact & settings", "Logo"];
const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 sm:h-9 sm:text-sm";

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [country, setCountry] = React.useState("Nigeria");
  const defaults = COUNTRIES.find((c) => c.name === country);
  const [timezone, setTimezone] = React.useState(defaults?.timezone ?? "Africa/Lagos");
  const [currency, setCurrency] = React.useState(defaults?.currency ?? "NGN");
  const [days, setDays] = React.useState<number[]>([0]);
  const [state, action] = useActionState(createChurch, null);
  const churchId = state?.ok ? state.data?.id : undefined;
  const fe = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  const chooseCountry = (name: string) => {
    setCountry(name);
    const d = COUNTRIES.find((c) => c.name === name);
    if (d) {
      setTimezone(d.timezone);
      setCurrency(d.currency);
    }
  };

  // Jump to the logo step on success, or back to the step that has errors.
  const [prevState, setPrevState] = React.useState(state);
  if (prevState !== state) {
    setPrevState(state);
    if (churchId) setStep(2);
    else if (state && !state.ok && state.fieldErrors) {
      const step0 = ["name", "country", "state", "city", "address"];
      setStep(Object.keys(state.fieldErrors).some((k) => step0.includes(k)) ? 0 : 1);
    }
  }

  const finish = async () => {
    const res = await completeOnboarding();
    if (!res.ok) toast.error(res.error);
    router.push("/dashboard");
    router.refresh();
  };

  const allZones = React.useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return COMMON_TIMEZONES;
    }
  }, []);

  return (
    <Card>
      <CardContent className="p-5 sm:p-8">
        <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  i < step && "border-primary bg-primary text-primary-foreground",
                  i === step && "border-primary text-primary",
                )}
                aria-current={i === step ? "step" : undefined}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={cn("hidden text-sm sm:block", i === step ? "font-semibold" : "text-muted-foreground")}>{s}</span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
            </li>
          ))}
        </ol>

        {step < 2 ? (
          <form action={action} className="grid gap-5" noValidate>
            <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
            {/* Both steps stay mounted so the final submit includes every field. */}
            <div className={cn("grid gap-4", step !== 0 && "hidden")}>
              <Field label="Church name" htmlFor="name" required error={fe("name")}>
                <Input name="name" autoComplete="organization" placeholder="e.g. Grace Assembly, Ikeja" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Country" htmlFor="country" error={fe("country")}>
                  <select name="country" className={selectClass} value={country} onChange={(e) => chooseCountry(e.target.value)}>
                    {COUNTRIES.map((c) => (
                      <option key={c.name}>{c.name}</option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </Field>
                <Field label="State / region" htmlFor="state" error={fe("state")}>
                  {country === "Nigeria" ? (
                    <select name="state" className={selectClass} defaultValue="">
                      <option value="">Select state</option>
                      {NIGERIAN_STATES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <Input name="state" />
                  )}
                </Field>
              </div>
              <Field label="City" htmlFor="city" error={fe("city")}>
                <Input name="city" />
              </Field>
              <Field label="Address" htmlFor="address" error={fe("address")}>
                <Textarea name="address" rows={2} />
              </Field>
            </div>

            <div className={cn("grid gap-4", step !== 1 && "hidden")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Church phone" htmlFor="phone" error={fe("phone")}>
                  <Input name="phone" type="tel" inputMode="tel" />
                </Field>
                <Field label="Church email" htmlFor="email" error={fe("email")}>
                  <Input name="email" type="email" inputMode="email" />
                </Field>
              </div>
              <Field label="Website" htmlFor="website" error={fe("website")} hint="Optional, e.g. https://gracechurch.org">
                <Input name="website" type="url" inputMode="url" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Timezone" htmlFor="timezone" required error={fe("timezone")}>
                  <select name="timezone" className={selectClass} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    {allZones.map((z) => (
                      <option key={z}>{z}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Currency" htmlFor="currency" required error={fe("currency")}>
                  <select name="currency" className={selectClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Usual service days</legend>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d, i) => {
                    const on = days.includes(i);
                    return (
                      <label
                        key={d}
                        className={cn(
                          "flex h-10 cursor-pointer items-center rounded-md border px-3 text-sm select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                          on ? "border-primary bg-accent font-medium text-primary" : "bg-card",
                        )}
                      >
                        <input
                          type="checkbox"
                          name="service_days"
                          value={i}
                          checked={on}
                          onChange={() => setDays((prev) => (on ? prev.filter((x) => x !== i) : [...prev, i]))}
                          className="sr-only"
                        />
                        {d.slice(0, 3)}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              {step > 0 ? (
                <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
                  <ArrowLeft /> Back
                </Button>
              ) : (
                <span />
              )}
              {step === 0 ? (
                <div className="flex gap-2">
                  <Button type="button" onClick={() => setStep(1)}>
                    Continue <ArrowRight />
                  </Button>
                </div>
              ) : (
                <SubmitButton pendingText="Creating church…">Create church</SubmitButton>
              )}
            </div>
            {step === 1 && <p className="text-right text-xs text-muted-foreground">Optional fields can be left blank and completed later in Settings.</p>}
          </form>
        ) : (
          <div className="grid gap-6">
            <div>
              <h2 className="font-semibold">Add your church logo</h2>
              <p className="text-sm text-muted-foreground">It appears in the sidebar and on exports. You can skip this for now.</p>
            </div>
            {churchId && <LogoUploader churchId={churchId} currentPath={null} />}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={finish}>
                Skip for now
              </Button>
              <Button onClick={finish}>
                Go to dashboard <ArrowRight />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
