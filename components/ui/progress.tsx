import { cn } from "@/lib/utils";

/** Simple accessible progress bar (value 0–100). */
function Progress({ value, className, indicatorClassName, label }: { value: number; className?: string; indicatorClassName?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label} className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full bg-primary transition-all", indicatorClassName)} style={{ width: `${v}%` }} />
    </div>
  );
}

export { Progress };
