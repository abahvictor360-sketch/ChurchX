import { cn } from "@/lib/utils";

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v6M9 6h6" />
          <path d="M5 21V12l7-4 7 4v9" />
          <path d="M10 21v-4a2 2 0 0 1 4 0v4" />
        </svg>
      </span>
      {withText && (
        <span className="text-lg">
          Church<span className="text-primary">X</span>
        </span>
      )}
    </span>
  );
}
