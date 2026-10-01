import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** KPI tile: label + icon chip, big value, caption, optional trend and mini bars. */
export function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  href,
  trend,
  bars,
  tone = "orange",
}: {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  icon: LucideIcon;
  href?: string;
  trend?: number | null;
  bars?: number[];
  tone?: "orange" | "teal" | "green" | "red";
}) {
  const toneClass = {
    orange: "text-primary",
    teal: "text-secondary",
    green: "text-success",
    red: "text-destructive",
  }[tone];
  const body = (
    <Card className={cn("h-full gap-3 p-4 transition-shadow sm:p-5", href && "hover:shadow-md")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border bg-card", toneClass)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight tabular-nums sm:text-[28px]">{value}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {typeof trend === "number" && (
              <span className={cn("inline-flex items-center font-semibold", trend >= 0 ? "text-success" : "text-destructive")}>
                {trend >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
                {Math.abs(trend)}%<span className="sr-only">{trend >= 0 ? " increase" : " decrease"}</span>
              </span>
            )}
            {caption}
          </div>
        </div>
        {bars && bars.some((b) => b > 0) && <MiniBars values={bars} />}
      </div>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-10 items-end gap-[3px]" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className={cn("w-1.5 rounded-sm", i === values.length - 1 ? "bg-primary" : "bg-primary/25")}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
