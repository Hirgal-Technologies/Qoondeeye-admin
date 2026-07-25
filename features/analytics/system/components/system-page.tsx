"use client";

import {
  Activity,
  BellRing,
  CircleCheck,
  CloudOff,
  Layers,
  RefreshCw,
} from "lucide-react";
import { LineTrendChart } from "@/components/charts/lazy";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { useDashboardFilters } from "@/components/dashboard/DashboardFilters";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatTile } from "@/components/dashboard/StatTile";
import { StatePanel } from "@/components/states/StatePanel";
import type {
  AlertTrendPoint,
  OcrSuccessPoint,
  SyncHealthPoint,
  SyncStatus,
  SystemErrorRow,
  TableCountRow,
} from "@/features/analytics/system/contracts";
import { formatDateTime, formatInteger, formatPercent } from "@/lib/formatters";
import { useApiData } from "@/lib/hooks/useApiData";

export function SystemHealthPage() {
  const { rangeLabel, withDateRange } = useDashboardFilters();
  const sync = useApiData<SyncHealthPoint[]>(withDateRange("/api/system/sync-health"));
  const ocr = useApiData<OcrSuccessPoint[]>(withDateRange("/api/system/ocr-success-rate"));
  const errors = useApiData<SystemErrorRow[]>(
    withDateRange("/api/system/errors", { limit: "100" })
  );
  const syncStatus = useApiData<SyncStatus>("/api/system/sync-status");

  const lastEntryAt =
    syncStatus.status === "success" ? syncStatus.data.lastEntryAt : undefined;
  const syncWorking =
    syncStatus.status === "success" ? syncStatus.data.working : undefined;

  const syncTotals =
    sync.status === "success" && sync.data.length
      ? sync.data.reduce(
          (total, point) => ({
            successRate: total.successRate + point.successRate,
            failures: total.failures + point.failures,
            queueDepth: total.queueDepth + point.avgQueueDepth,
          }),
          { successRate: 0, failures: 0, queueDepth: 0 }
        )
      : undefined;
  const averageSyncRate =
    syncTotals && sync.status === "success"
      ? syncTotals.successRate / sync.data.length
      : undefined;
  const averageQueueDepth =
    syncTotals && sync.status === "success"
      ? syncTotals.queueDepth / sync.data.length
      : undefined;
  const totalEntries =
    ocr.status === "success" && ocr.data.length
      ? ocr.data.reduce((total, point) => total + point.attempts, 0)
      : undefined;

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeading
        eyebrow="Operations"
        title="System health"
        description={`Monitor ledger entry timeliness, alerts, and admin activity across ${rangeLabel.toLowerCase()}.`}
        actions={
          <span className="inline-flex min-h-9 items-center gap-2 rounded-md border bg-card px-3 text-xs text-muted-foreground">
            <span
              className={`size-1.5 rounded-full ${
                errors.status === "success" && errors.data.length > 0
                  ? "bg-destructive"
                  : "bg-foreground"
              }`}
            />
            {errors.status === "success" && errors.data.length > 0
              ? `${errors.data.length} alert groups`
              : "No active alerts"}
          </span>
        }
      />

      <section aria-labelledby="health-kpis">
        <h2 id="health-kpis" className="sr-only">
          System health key metrics
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatTile
            icon={RefreshCw}
            label="Sync"
            value={
              syncWorking === undefined
                ? undefined
                : syncWorking
                  ? "Working"
                  : "Not working"
            }
            sublabel={
              lastEntryAt
                ? `Last entry ${formatDateTime(lastEntryAt)}`
                : "No entries received in the last 24 hours"
            }
            status={syncWorking === false ? "critical" : "default"}
            isLoading={syncStatus.status === "loading"}
            error={syncStatus.status === "error" ? syncStatus.error : null}
          />
          <StatTile
            icon={CircleCheck}
            label="Same-day entries"
            value={typeof averageSyncRate === "number" ? formatPercent.format(averageSyncRate) : undefined}
            sublabel="Entries recorded on the expense date"
            isLoading={sync.status === "loading"}
            error={sync.status === "error" ? sync.error : null}
          />
          <StatTile
            icon={CloudOff}
            label="Delayed syncs"
            value={syncTotals ? formatInteger.format(syncTotals.failures) : undefined}
            sublabel="Entries that arrived after their expense date"
            status={syncTotals && syncTotals.failures > 0 ? "critical" : "default"}
            isLoading={sync.status === "loading"}
            error={sync.status === "error" ? sync.error : null}
          />
          <StatTile
            icon={Activity}
            label="Average entry lag"
            value={
              typeof averageQueueDepth === "number"
                ? `${averageQueueDepth.toFixed(1)} days`
                : undefined
            }
            sublabel="From expense date to recorded entry"
            isLoading={sync.status === "loading"}
            error={sync.status === "error" ? sync.error : null}
          />
          <StatTile
            icon={Layers}
            label="Successful syncs"
            value={typeof totalEntries === "number" ? formatInteger.format(totalEntries) : undefined}
            sublabel={`Entries stored in the database, ${rangeLabel.toLowerCase()}`}
            isLoading={ocr.status === "loading"}
            error={ocr.status === "error" ? ocr.error : null}
          />
          <StatTile
            icon={BellRing}
            label="Alert groups"
            value={errors.status === "success" ? formatInteger.format(errors.data.length) : undefined}
            sublabel={rangeLabel}
            status={
              errors.status === "success" &&
              errors.data.some((row) => row.priority === "high")
                ? "critical"
                : "default"
            }
            isLoading={errors.status === "loading"}
            error={errors.status === "error" ? errors.error : null}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard<SyncHealthPoint[]>
          title="Entry timeliness"
          description="Share of ledger entries recorded on the same day as the expense"
          summary="Line chart showing same-day entry percentage over time."
          url={withDateRange("/api/system/sync-health")}
          exportSource="system/sync-health"
          emptyTitle="No ledger entries recorded"
          emptyDescription="No expenses were recorded in this period. Widen the date range to see activity."
        >
          {(data) => (
            <LineTrendChart
              data={data.map((point) => ({
                ...point,
                successRate: point.successRate * 100,
              }))}
              xKey="date"
              yKey="successRate"
              valueFormatter={(value) => `${Math.round(value)}%`}
            />
          )}
        </ChartCard>

        <ChartCard<OcrSuccessPoint[]>
          title="Daily ledger entries"
          description="Ledger entries recorded per day"
          summary="Line chart showing the number of ledger entries recorded each day."
          url={withDateRange("/api/system/ocr-success-rate")}
          exportSource="system/ocr-success-rate"
          emptyTitle="No ledger entries recorded"
          emptyDescription="No expenses were recorded in this period. Widen the date range to see activity."
        >
          {(data) => (
            <LineTrendChart
              data={data}
              xKey="date"
              yKey="attempts"
              color="var(--series-2)"
              valueFormatter={(value) => formatInteger.format(value)}
            />
          )}
        </ChartCard>

        <ChartCard<AlertTrendPoint[]>
          title="Alerts per day"
          description="App notifications sent to users, with high-priority alerts highlighted"
          summary="Line chart showing total and high-priority alerts per day."
          url={withDateRange("/api/system/alerts-trend")}
          exportSource="system/alerts-trend"
          emptyTitle="No alerts in this period"
          emptyDescription="No budget or subscription notifications were sent. Widen the date range to see activity."
        >
          {(data) => (
            <LineTrendChart
              data={data}
              xKey="date"
              series={[
                { key: "total", label: "All alerts", color: "var(--series-1)" },
                {
                  key: "high",
                  label: "High priority",
                  color: "var(--series-2)",
                  dashed: true,
                },
              ]}
              valueFormatter={(value) => formatInteger.format(value)}
            />
          )}
        </ChartCard>

        <ChartCard<TableCountRow[]>
          title="Database footprint"
          description="Live row counts for the core application tables"
          summary="Table listing each core database table and its current row count."
          url="/api/system/table-counts"
          exportSource="system/table-counts"
          emptyTitle="No tables reported"
          emptyDescription="Row counts could not be collected from the database."
        >
          {(data) => (
            <div className="h-full overflow-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">
                  Core database tables and their current row counts
                </caption>
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-medium">Table</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data]
                    .sort((a, b) => b.rows - a.rows)
                    .map((row, index) => (
                      <tr
                        key={row.table}
                        className={`border-b last:border-0 ${
                          index % 2 === 1 ? "bg-[hsl(var(--surface-table-row-alt))]" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-medium text-foreground">{row.table}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatInteger.format(row.rows)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>

      <section
        className="min-w-0 rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
        aria-labelledby="incidents-title"
      >
        <div>
          <h2 id="incidents-title" className="text-sm font-semibold">
            Recent alerts and admin activity
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Grouped app notifications (budget and subscription alerts) alongside audit-logged admin
            actions. User-specific details are never shown.
          </p>
        </div>

        <div className="mt-4">
          {errors.status === "loading" ? <IncidentSkeleton /> : null}
          {errors.status === "error" ? (
            <StatePanel
              compact
              kind="error"
              title="Incident feed unavailable"
              description={errors.error}
              actionLabel="Retry"
              onAction={errors.retry}
            />
          ) : null}
          {errors.status === "success" && errors.data.length === 0 ? (
            <StatePanel
              compact
              title="No alerts in this period"
              description="No app notifications or admin actions were recorded. Continue monitoring or widen the date range."
            />
          ) : null}
          {errors.status === "success" && errors.data.length > 0 ? (
            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <table className="w-full min-w-[720px] text-left text-xs">
                <caption className="sr-only">
                  Recent alerts and admin actions grouped by type and summary
                </caption>
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
                    <th scope="col" className="px-3 py-2.5 font-medium">Severity</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Last seen</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Summary</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Events</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.data.map((row, index) => {
                    const critical = row.priority === "high";
                    return (
                      <tr
                        key={`${row.timestamp}-${index}`}
                        className={`border-b transition-colors last:border-0 hover:bg-[hsl(var(--surface-table-hover))] ${
                          index % 2 === 1 ? "bg-[hsl(var(--surface-table-row-alt))]" : ""
                        }`}
                      >
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium ${
                              critical
                                ? "bg-critical-muted text-critical"
                                : "bg-warning-muted text-warning"
                            }`}
                          >
                            <span className={`size-1.5 rounded-full ${critical ? "bg-critical" : "bg-warning"}`} />
                            {critical ? "Critical" : "Warning"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground tabular-nums">
                          {formatDateTime(row.timestamp)}
                        </td>
                        <td className="px-3 py-3 font-medium text-foreground">{row.errorType}</td>
                        <td className="max-w-md truncate px-3 py-3 text-muted-foreground">{row.message}</td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">{row.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function IncidentSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading incidents">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="skeleton h-10 rounded-md" />
      ))}
    </div>
  );
}
