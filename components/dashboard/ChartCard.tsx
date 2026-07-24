"use client";

import type { ReactNode } from "react";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { ChartSkeleton, StatePanel } from "@/components/states/StatePanel";
import { useApiData } from "@/lib/hooks/useApiData";

type ChartCardProps<T> = {
  title: string;
  description?: string;
  summary?: string;
  url: string;
  exportSource?: string;
  exportParams?: Record<string, string>;
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  children: (data: T) => ReactNode;
};

export function ChartCard<T>({
  title,
  description,
  summary,
  url,
  exportSource,
  exportParams,
  isEmpty,
  emptyTitle = "No data in this period",
  emptyDescription = "Try a wider date range or check back after more activity is recorded.",
  className = "",
  children,
}: ChartCardProps<T>) {
  const state = useApiData<T>(url);
  const empty =
    state.status === "success" &&
    (isEmpty?.(state.data) ?? isDataEmpty(state.data));

  return (
    <section
      className={`flex min-w-0 flex-col rounded-lg border bg-card p-4 text-card-foreground shadow-[var(--shadow-card)] sm:p-5 ${className}`}
      aria-labelledby={`${toId(title)}-title`}
    >
      <div className="flex min-h-10 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${toId(title)}-title`} className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {exportSource ? (
          <ExportButton source={exportSource} params={exportParams} />
        ) : null}
      </div>

      <div className="mt-4 min-h-64">
        {state.status === "loading" ? <ChartSkeleton /> : null}
        {state.status === "error" ? (
          <StatePanel
            compact
            kind="error"
            title="Chart unavailable"
            description={state.error}
            actionLabel="Retry"
            onAction={state.retry}
          />
        ) : null}
        {empty ? (
          <StatePanel
            compact
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : null}
        {state.status === "success" && !empty ? (
          <div className="h-64 w-full">{children(state.data)}</div>
        ) : null}
      </div>

      {summary ? <p className="sr-only">{summary}</p> : null}
    </section>
  );
}

function isDataEmpty(data: unknown): boolean {
  if (Array.isArray(data)) return data.length === 0;
  return data === null || data === undefined;
}

function toId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
