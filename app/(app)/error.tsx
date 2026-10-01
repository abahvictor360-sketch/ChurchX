"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] render error", error.digest ?? error.message);
  }, [error]);
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        description="We couldn't load this page. Check your connection and try again. If it keeps happening, contact your administrator."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </Card>
  );
}
