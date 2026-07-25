"use client";

import { useEffect } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";

export default function Error({
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
    <main className="grid min-h-screen place-items-center px-5 py-16">
      <div className="w-full max-w-md text-center" role="alert">
        <span className="mx-auto mb-5 grid size-12 place-items-center rounded-md border bg-card text-muted-foreground">
          <CircleAlert aria-hidden="true" className="size-5" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          An unexpected error interrupted this page. The issue has been logged; trying again
          usually resolves temporary problems.
        </p>
        {error.digest ? (
          <p className="mt-2 text-[11px] text-muted-foreground">Reference: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-md border bg-background px-4 text-xs font-medium transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Try again
        </button>
      </div>
    </main>
  );
}
