"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { CalendarDays, Church, Loader2, Search, UserPlus, Users, UsersRound } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { globalSearch, type SearchResult } from "@/features/shell/actions";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  member: Users,
  visitor: UserPlus,
  department: UsersRound,
  service: Church,
  event: CalendarDays,
};
const GROUPS: Record<string, string> = { member: "Members", visitor: "Visitors", department: "Departments", service: "Services", event: "Events" };

export function useCommandSearch() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "/") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

export function SearchTrigger({ onOpen, className }: { onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex h-9 w-full max-w-sm items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-ring/50",
        className,
      )}
    >
      <Search className="size-4" aria-hidden />
      <span className="flex-1 text-left">Search members, visitors…</span>
      <kbd className="hidden rounded border bg-card px-1.5 py-0.5 font-sans text-[10px] font-semibold sm:inline">Ctrl K</kbd>
    </button>
  );
}

export function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [found, setFound] = React.useState<{ query: string; results: SearchResult[] }>({ query: "", results: [] });
  const searchable = query.trim().length >= 2;
  const loading = searchable && found.query !== query;
  const results = searchable ? found.results : [];

  React.useEffect(() => {
    if (query.trim().length < 2) return;
    let active = true;
    const t = setTimeout(async () => {
      const r = await globalSearch(query);
      if (active) setFound({ query, results: r });
    }, 220);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  const groups = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.kind] ??= []).push(r);
    return acc;
  }, {});

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Command shouldFilter={false} label="Global search">
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search members, visitors, departments, services, events…"
              className="h-12 flex-1 bg-transparent text-base outline-none sm:text-sm"
              autoFocus
            />
            {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Searching" />}
          </div>
          <Command.List className="max-h-[60dvh] overflow-y-auto p-2">
            {query.trim().length < 2 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Type at least 2 characters to search.</p>
            ) : (
              !loading && <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">No results found.</Command.Empty>
            )}
            {Object.entries(groups).map(([kind, items]) => {
              const Icon = ICONS[kind] ?? Search;
              return (
                <Command.Group
                  key={kind}
                  heading={GROUPS[kind] ?? kind}
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {items.map((r) => (
                    <Command.Item
                      key={r.kind + r.id}
                      value={r.kind + r.id}
                      onSelect={() => go(r.href)}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 data-[selected=true]:bg-accent"
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
