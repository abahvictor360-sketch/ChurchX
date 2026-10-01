"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FilterDef = { name: string; label: string; options: { value: string; label: string }[]; allLabel?: string };

/** Search + filter controls that live in the URL (shareable, server-rendered). */
export function ListToolbar({
  placeholder = "Search…",
  filters = [],
  className,
  children,
}: {
  placeholder?: string;
  filters?: FilterDef[];
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [, startTransition] = React.useTransition();

  const update = React.useCallback(
    (key: string, value: string | null) => {
      const sp = new URLSearchParams(params.toString());
      if (value) sp.set(key, value);
      else sp.delete(key);
      sp.delete("page");
      startTransition(() => router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  React.useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => update("q", q.trim() || null), 300);
    return () => clearTimeout(t);
  }, [q, params, update]);

  return (
    <div className={cn("flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:p-4", className)}>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-9"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Select key={f.name} value={params.get(f.name) ?? "all"} onValueChange={(v) => update(f.name, v === "all" ? null : v)}>
            <SelectTrigger className="w-full min-w-36 sm:w-auto" aria-label={f.label}>
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{f.allLabel ?? `All ${f.label.toLowerCase()}`}</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {children}
      </div>
    </div>
  );
}
