import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-2 h-7 w-56" />
      <Skeleton className="mb-6 h-4 w-40" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="mt-4 h-80" />
    </div>
  );
}
