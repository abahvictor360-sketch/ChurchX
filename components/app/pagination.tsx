import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PAGE_SIZE = 25;

export function pageRange(page: number, size = PAGE_SIZE) {
  const from = (page - 1) * size;
  return { from, to: from + size - 1 };
}

export function parsePage(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function Pagination({
  page,
  total,
  size = PAGE_SIZE,
  basePath,
  params,
}: {
  page: number;
  total: number;
  size?: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && k !== "page" && sp.set(k, v));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };
  const start = total === 0 ? 0 : (page - 1) * size + 1;
  const end = Math.min(total, page * size);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
      <span>
        {start}–{end} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page - 1)} aria-label="Previous page">
              <ChevronLeft /> Prev
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft /> Prev
          </Button>
        )}
        <span className="hidden sm:inline">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page + 1)} aria-label="Next page">
              Next <ChevronRight />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next <ChevronRight />
          </Button>
        )}
      </div>
    </nav>
  );
}
