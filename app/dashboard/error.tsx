"use client";

import { useEffect } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="flex min-h-72 w-full flex-col items-center justify-center rounded-md border border-dashed bg-muted/25 px-6 py-10 text-center"
      role="alert"
    >
      <span className="mb-3 grid size-9 place-items-center rounded-md border bg-card text-muted-foreground">
        <CircleAlert aria-hidden="true" className="size-4" />
      </span>
      <p className="text-sm font-medium text-foreground">This page failed to load</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
        An unexpected error interrupted this dashboard module. The rest of the dashboard remains
        available from the navigation.
      </p>
      {error.digest ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
      >
        <RotateCcw aria-hidden="true" className="size-3.5" />
        Try again
      </button>
    </div>
  );
}
