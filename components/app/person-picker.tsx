"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { Command } from "cmdk";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { searchPeople, type PersonOption } from "@/features/people/actions";
import { cn } from "@/lib/utils";

/**
 * Searchable person selector. Writes the selected id to a hidden input named
 * `name` (and `${name}_kind` when kind="all").
 */
export function PersonPicker({
  name,
  kind = "member",
  defaultValue,
  placeholder = "Search by name…",
  onChange,
  id,
  disabled,
  ...aria
}: {
  name?: string;
  kind?: "all" | "member" | "visitor";
  defaultValue?: PersonOption | null;
  placeholder?: string;
  onChange?: (value: PersonOption | null) => void;
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState<PersonOption | null>(defaultValue ?? null);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PersonOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await searchPeople(query, kind);
      if (active) {
        setResults(r);
        setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, kind, open]);

  const select = (p: PersonOption | null) => {
    setValue(p);
    onChange?.(p);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1">
      {name && <input type="hidden" name={name} value={value?.id ?? ""} />}
      {name && kind === "all" && <input type="hidden" name={`${name}_kind`} value={value?.kind ?? ""} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-10 w-full justify-between font-normal sm:h-9"
            {...aria}
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value ? `${value.name}${value.detail ? ` · ${value.detail}` : ""}` : placeholder}
            </span>
            <ChevronsUpDown className="opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
          <Command shouldFilter={false} label="Search people">
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Type a name…"
              className="h-10 w-full border-b bg-transparent px-3 text-sm outline-none"
              autoFocus
            />
            <Command.List className="max-h-64 overflow-y-auto p-1">
              {loading && (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Searching…
                </div>
              )}
              {!loading && results.length === 0 && <Command.Empty className="px-3 py-3 text-sm text-muted-foreground">No matches.</Command.Empty>}
              {results.map((p) => (
                <Command.Item
                  key={`${p.kind}-${p.id}`}
                  value={`${p.kind}-${p.id}`}
                  onSelect={() => select(p)}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm data-[selected=true]:bg-muted"
                >
                  <span className="truncate">
                    {p.name}
                    {p.detail && <span className="ml-1.5 text-xs text-muted-foreground">{p.detail}</span>}
                  </span>
                  {value?.id === p.id && <Check className="size-4 text-primary" />}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </PopoverContent>
      </Popover>
      {value && !disabled && (
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => select(null)} aria-label="Clear selection">
          <X />
        </Button>
      )}
    </div>
  );
}
