"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown, Loader2, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/app/status-badge";
import {
  bulkMark,
  checkIn,
  correctAttendance,
  listServiceAttendance,
  searchCheckin,
  type AttendanceEntry,
  type CheckinPerson,
} from "@/features/attendance/actions";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";

type Mode = "search" | "list" | "present";

export function CheckinBoard({
  serviceId,
  canRecord,
  canCorrect,
  canRegisterVisitor,
  initialCount,
}: {
  serviceId: string;
  canRecord: boolean;
  canCorrect: boolean;
  canRegisterVisitor: boolean;
  initialCount: number;
}) {
  const [mode, setMode] = React.useState<Mode>(canRecord ? "search" : "present");
  const [query, setQuery] = React.useState("");
  const [people, setPeople] = React.useState<CheckinPerson[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState<Set<string>>(new Set());
  const [count, setCount] = React.useState(initialCount);
  const [entries, setEntries] = React.useState<AttendanceEntry[] | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(
    async (q: string, offset = 0) => {
      setLoading(true);
      const res = await searchCheckin(serviceId, q, offset);
      setPeople((prev) => (offset ? [...prev, ...res.people] : res.people));
      setTotal(res.total);
      setLoading(false);
    },
    [serviceId],
  );

  const loadEntries = React.useCallback(async () => {
    const list = await listServiceAttendance(serviceId);
    setEntries(list);
    setCount(list.filter((e) => e.status === "present").length);
  }, [serviceId]);

  // Debounced search (search mode needs ≥2 chars; list mode shows everyone A–Z).
  React.useEffect(() => {
    if (mode === "present") return;
    if (mode === "search" && query.trim().length < 2) return;
    const t = setTimeout(() => load(query.trim()), mode === "search" ? 200 : 0);
    return () => clearTimeout(t);
  }, [query, mode, load]);

  React.useEffect(() => {
    if (mode !== "present") return;
    let active = true;
    listServiceAttendance(serviceId).then((list) => {
      if (!active) return;
      setEntries(list);
      setCount(list.filter((e) => e.status === "present").length);
    });
    return () => {
      active = false;
    };
  }, [mode, serviceId]);

  const doCheckIn = async (p: CheckinPerson) => {
    if (busy.has(p.id)) return;
    setBusy((b) => new Set(b).add(p.id));
    const res = await checkIn(serviceId, p.id, p.kind);
    setBusy((b) => {
      const n = new Set(b);
      n.delete(p.id);
      return n;
    });
    if (res.ok) {
      setPeople((list) => list.map((x) => (x.id === p.id ? { ...x, attendanceId: res.data?.attendanceId ?? "x", status: "present" } : x)));
      setCount((c) => c + 1);
      toast.success(`${p.name} checked in`);
      if (mode === "search") {
        setQuery("");
        setPeople([]);
        inputRef.current?.focus();
      }
    } else {
      toast.error(res.error);
    }
  };

  const doBulk = async (status: string) => {
    setBulkBusy(true);
    const res = await bulkMark(serviceId, [...selected], status);
    setBulkBusy(false);
    if (res.ok) {
      toast.success(res.message ?? "Saved");
      setSelected(new Set());
      load(query.trim());
      setCount((c) => (status === "present" ? c + selected.size : c));
    } else toast.error(res.error);
  };

  const doCorrect = async (e: AttendanceEntry, status: string) => {
    const res = await correctAttendance(e.id, status);
    if (res.ok) {
      toast.success(`${e.name}: ${status}`);
      loadEntries();
    } else toast.error(res.error);
  };

  const showResults = mode === "list" || (mode === "search" && query.trim().length >= 2);
  const memberRows = people.filter((p) => p.kind === "member" && !p.attendanceId);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Check-in mode" className="inline-flex rounded-lg border bg-card p-1 text-sm">
          {canRecord &&
            (
              [
                ["search", "Search"],
                ["list", "Member list"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={mode === k}
                onClick={() => {
                  setMode(k);
                  setSelected(new Set());
                }}
                className={cn("rounded-md px-3 py-1.5 font-medium", mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
              </button>
            ))}
          <button
            role="tab"
            aria-selected={mode === "present"}
            onClick={() => setMode("present")}
            className={cn("rounded-md px-3 py-1.5 font-medium", mode === "present" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            Checked in <span className="tabular-nums">({count})</span>
          </button>
        </div>
        {canRegisterVisitor && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/visitors/new?service=${serviceId}`}>
              <UserPlus /> <span className="hidden sm:inline">New visitor</span>
            </Link>
          </Button>
        )}
      </div>

      {mode !== "present" && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            ref={inputRef}
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === "search" ? "Type a name or member number…" : "Filter the list…"}
            aria-label="Search people to check in"
            className="h-14 rounded-xl pl-12 text-lg sm:h-14 sm:text-lg"
          />
          {loading && <Loader2 className="absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Searching" />}
        </div>
      )}

      {mode === "list" && selected.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-accent px-3 py-2 text-sm shadow-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button size="sm" disabled={bulkBusy} onClick={() => doBulk("present")}>
            {bulkBusy ? <Loader2 className="animate-spin" /> : <Check />} Mark present
          </Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => doBulk("excused")}>
            Excused
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {showResults && (
        <div className="overflow-hidden rounded-xl border bg-card">
          {mode === "list" && memberRows.length > 0 && (
            <label className="flex items-center gap-3 border-b px-4 py-2 text-sm text-muted-foreground">
              <Checkbox
                checked={memberRows.every((p) => selected.has(p.id)) ? true : selected.size ? "indeterminate" : false}
                onCheckedChange={(c) => setSelected(c ? new Set(memberRows.map((p) => p.id)) : new Set())}
              />
              Select all shown ({memberRows.length})
            </label>
          )}
          {people.length === 0 && !loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No one found.{" "}
              {canRegisterVisitor && (
                <Link href={`/visitors/new?service=${serviceId}`} className="font-medium text-primary hover:underline">
                  Register a new visitor
                </Link>
              )}
            </p>
          ) : (
            <ul className="divide-y" aria-live="polite">
              {people.map((p) => {
                const done = Boolean(p.attendanceId);
                return (
                  <li key={`${p.kind}-${p.id}`} className="flex items-center gap-3 px-4 py-3">
                    {mode === "list" && p.kind === "member" && !done && (
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() =>
                          setSelected((s) => {
                            const n = new Set(s);
                            if (n.has(p.id)) n.delete(p.id);
                            else n.add(p.id);
                            return n;
                          })
                        }
                        aria-label={`Select ${p.name}`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.kind === "visitor" ? "Visitor" : (p.number ?? "Member")}</p>
                    </div>
                    {done ? (
                      <StatusBadge status={p.status ?? "present"} />
                    ) : (
                      <Button size="lg" className="h-12 min-w-28" disabled={busy.has(p.id)} onClick={() => doCheckIn(p)} aria-label={`Check in ${p.name}`}>
                        {busy.has(p.id) ? <Loader2 className="animate-spin" /> : <Check />} Check in
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {mode === "list" && people.length < total && (
            <div className="border-t p-3 text-center">
              <Button variant="outline" disabled={loading} onClick={() => load(query.trim(), people.length)}>
                Load more ({total - people.length} remaining)
              </Button>
            </div>
          )}
        </div>
      )}

      {mode === "search" && query.trim().length < 2 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Start typing a name to check someone in. Use “Member list” to mark many people at once.</p>
      )}

      {mode === "present" && (
        <div className="overflow-hidden rounded-xl border bg-card">
          {entries === null ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No one has been checked in yet.</p>
          ) : (
            <ul className="divide-y">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.kind === "visitor" ? "Visitor" : (e.number ?? "Member")} · {formatTime(new Date(e.checkedInAt).toTimeString().slice(0, 5))}
                      {e.method === "bulk" && " · bulk"}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                  {(canCorrect || canRecord) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Correct attendance for ${e.name}`}>
                          <ChevronDown />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {["present", "excused", "absent"]
                          .filter((s) => s !== e.status)
                          .map((s) => (
                            <DropdownMenuItem key={s} onSelect={() => doCorrect(e, s)}>
                              {s === "absent" ? <X /> : <Check />} Mark {s}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
