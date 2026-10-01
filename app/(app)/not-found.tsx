import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";

export default function NotFound() {
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <EmptyState
        icon={SearchX}
        title="Not found"
        description="This record does not exist, was archived, or you don't have access to it."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </Card>
  );
}
