"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions";

/**
 * Runs a server action from an event handler with pending state, toast
 * feedback and router refresh. Prevents concurrent double submissions.
 */
export function useAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<ActionResult<T>>,
  opts: { success?: string; onSuccess?: (data: T | undefined) => void; refresh?: boolean } = {},
) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const running = React.useRef(false);

  const run = React.useCallback(
    (...args: Args) =>
      new Promise<ActionResult<T> | null>((resolve) => {
        if (running.current) return resolve(null);
        running.current = true;
        startTransition(async () => {
          try {
            const res = await action(...args);
            if (res.ok) {
              const msg = res.message ?? opts.success;
              if (msg) toast.success(msg);
              opts.onSuccess?.(res.data);
              if (opts.refresh !== false) router.refresh();
            } else {
              toast.error(res.error);
            }
            resolve(res);
          } catch {
            toast.error("Network problem — please check your connection and try again.");
            resolve(null);
          } finally {
            running.current = false;
          }
        });
      }),
    [action, opts, router],
  );

  return { run, pending };
}

/** For <form action={...}> with useActionState: toasts on result changes. */
export function useActionToast(state: ActionResult<unknown> | null, onSuccess?: () => void) {
  const last = React.useRef(state);
  React.useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      onSuccess?.();
    } else if (!state.fieldErrors) {
      toast.error(state.error);
    }
  }, [state, onSuccess]);
}
