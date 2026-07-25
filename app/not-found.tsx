import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-5 grid size-12 place-items-center rounded-md border bg-card text-muted-foreground">
          <Compass aria-hidden="true" className="size-5" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Error 404
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The page you requested does not exist or may have been moved. Check the address, or
          return to the dashboard.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-md border bg-background px-4 text-xs font-medium transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
