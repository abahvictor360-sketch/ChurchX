"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getNotifications, markNotificationsRead, type NotificationItem } from "@/features/shell/actions";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationsBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = React.useState(initialUnread);
  const [prevInitial, setPrevInitial] = React.useState(initialUnread);
  if (prevInitial !== initialUnread) {
    // Server sent a fresh count (navigation/refresh): adopt it.
    setPrevInitial(initialUnread);
    setUnread(initialUnread);
  }

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    getNotifications(8).then((r) => {
      if (!active) return;
      setItems(r.items);
      setUnread(r.unread);
    });
    return () => {
      active = false;
    };
  }, [open]);

  const markAll = async () => {
    const res = await markNotificationsRead();
    if (res.ok) {
      setUnread(0);
      setItems((list) => list?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null);
      router.refresh();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Bell />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,22rem)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAll}>
              <CheckCheck /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id} className="border-b last:border-0">
                  <Link
                    href={n.link ?? "/notifications"}
                    onClick={() => {
                      setOpen(false);
                      if (!n.read_at) markNotificationsRead([n.id]);
                    }}
                    className={cn("flex gap-3 px-4 py-3 hover:bg-muted", !n.read_at && "bg-accent/40")}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {n.title}
                        {!n.read_at && <span className="sr-only"> (unread)</span>}
                      </span>
                      {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                      <span className="block text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
