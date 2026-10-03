"use client";

import { formatAgeShort } from "@/lib/hooks/live-refresh";
import { useTickingNow } from "@/lib/hooks/use-ticking-now";

export function LiveStatus({
  refreshing,
  updatedAt,
  unavailable,
}: {
  refreshing: boolean;
  updatedAt: number | null;
  unavailable: boolean;
}) {
  const now = useTickingNow();
  const age = formatAgeShort(updatedAt, now);

  if (unavailable) {
    return (
      <p className="text-[11px] leading-4 text-muted-foreground" role="status">
        Live updates temporarily unavailable
        <span className="mt-0.5 block">Last successful update {age}</span>
      </p>
    );
  }

  return (
    <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground" role="status">
      <span
        className={`size-1.5 rounded-full ${refreshing ? "animate-pulse bg-primary" : "bg-emerald-500"}`}
        aria-hidden="true"
      />
      Live
      <span aria-hidden="true">·</span>
      Updated {age}
      {refreshing ? <span className="sr-only">Refreshing</span> : null}
    </p>
  );
}
