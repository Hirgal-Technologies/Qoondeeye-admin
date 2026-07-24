"use client";

import { Download } from "lucide-react";

export function ExportButton({
  source,
  params,
}: {
  source: string;
  params?: Record<string, string>;
}) {
  const query = new URLSearchParams({ source, ...(params ?? {}) }).toString();
  return (
    <a
      href={`/api/export/csv?${query}`}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
      aria-label="Export chart data as CSV"
    >
      <Download aria-hidden="true" className="size-3.5" />
      <span className="hidden sm:inline">Export</span>
    </a>
  );
}
