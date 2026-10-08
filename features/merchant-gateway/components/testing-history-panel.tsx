"use client";

import { StatePanel } from "@/components/states/StatePanel";
import type { TestingHistory } from "@/features/merchant-gateway/contracts";
import { formatTimestamp } from "@/features/merchant-gateway/presentation";
import { useApiData } from "@/lib/hooks/useApiData";

export function TestingHistoryPanel() {
  const history = useApiData<TestingHistory>("/api/merchant-gateway/testing-history");
  if (history.status === "loading") {
    return <p className="text-xs text-muted-foreground">Loading archived testing records…</p>;
  }
  if (history.status === "error") {
    return (
      <StatePanel
        compact
        kind="error"
        title="Testing history unavailable"
        description={history.error}
        actionLabel="Try again"
        onAction={history.retry}
      />
    );
  }
  const groups = [
    ["Orders", history.data.orders],
    ["Payments", history.data.payments],
    ["Alerts", history.data.alerts],
  ] as const;
  return (
    <section className="rounded-lg border bg-card p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold text-foreground">Testing history</h2>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
        Administrative archive of pre-production records. The fulfillment status shown here is the stored status.
        Archive does not mean TopTayo completed the recharge.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        {groups.map(([title, records]) => (
          <div key={title}>
            <h3 className="text-xs font-semibold text-foreground">
              {title} ({records.length})
            </h3>
            {records.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">None archived.</p>
            ) : (
              <ul className="mt-2 divide-y rounded-md border">
                {records.map((record) => (
                  <li key={`${record.kind}-${record.id}`} className="px-3 py-2 text-xs">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium text-foreground">{record.label}</p>
                      <p className="shrink-0 text-[11px] text-muted-foreground">
                        {formatTimestamp(record.archivedAt)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">{record.detail}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{record.id}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
