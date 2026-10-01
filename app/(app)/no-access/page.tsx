import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";

export const metadata = { title: "No access" };

export default function NoAccess() {
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <EmptyState
        icon={ShieldAlert}
        title="You don't have access to this page"
        description="Your role does not include this area. Ask your church administrator if you need access."
        action={
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </Card>
  );
}
