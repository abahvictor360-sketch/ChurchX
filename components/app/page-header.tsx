import Link from "next/link";
import { ChevronRight, House } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  crumbs = [],
  actions,
  className,
}: {
  title: string;
  description?: string;
  crumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mt-1.5 hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <Link href="/dashboard" className="hover:text-foreground" aria-label="Home">
              <House className="size-3.5" />
            </Link>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <ChevronRight className="size-3" aria-hidden />
                {c.href ? (
                  <Link href={c.href} className="hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-foreground">
                    {c.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
