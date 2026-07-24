"use client";

import {
  Activity,
  CircleAlert,
  CircleCheck,
  CloudOff,
  Gauge,
  HardDrive,
  ScanLine,
  ShieldAlert,
} from "lucide-react";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { useDashboardFilters } from "@/components/dashboard/DashboardFilters";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatTile } from "@/components/dashboard/StatTile";
import { StatePanel } from "@/components/states/StatePanel";
import { formatDateTime, formatInteger, formatPercent } from "@/lib/formatters";
import { useApiData } from "@/lib/hooks/useApiData";

type SyncPoint = {
  date: string;
  successRate: number;
  avgQueueDepth: number;
  failures: number;
};

type OcrPoint = {
  date: string;
  successRate: number;
  attempts: number;
};

type ErrorRow = {
  timestamp: string;
  errorType: string;
  message: string;
  count: number;
};

export default function SystemHealthPage() {
  const { rangeLabel, withDateRange } = useDashboardFilters();
  const sync = useApiData<SyncPoint[]>(withDateRange("/api/system/sync-health"));
  const ocr = useApiData<OcrPoint[]>(withDateRange("/api/system/ocr-success-rate"));
  const errors = useApiData<ErrorRow[]>(
    withDateRange("/api/system/errors", { limit: "100" })
  );

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
  const averageOcrRate =
    ocr.status === "success" && ocr.data.length
      ? ocr.data.reduce((total, point) => total + point.successRate, 0) /
        ocr.data.length
      : undefined;

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeading
        eyebrow="Operations"
        title="System health"
        description={`Monitor synchronization, authentication, OCR, latency, incidents, and storage reliability across ${rangeLabel.toLowerCase()}.`}
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
              ? `${errors.data.length} incident groups`
              : "No active incidents"}
          </span>
        }
      />

      <div className="flex items-start gap-3 rounded-lg border border-destructive/35 bg-destructive/5 p-4">
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <p className="text-xs font-medium">Mobile telemetry dependency</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Sync, OCR, error, latency, and storage metrics require event instrumentation from the
            mobile app. Unavailable modules fail safely without exposing internal database details.
          </p>
        </div>
      </div>

      <section aria-labelledby="health-kpis">
        <h2 id="health-kpis" className="sr-only">
          System health key metrics
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={CircleCheck}
            label="Sync success"
            value={typeof averageSyncRate === "number" ? formatPercent.format(averageSyncRate) : undefined}
            sublabel={rangeLabel}
            isLoading={sync.status === "loading"}
            error={sync.status === "error" ? sync.error : null}
          />
          <StatTile
            icon={CloudOff}
            label="Sync failures"
            value={syncTotals ? formatInteger.format(syncTotals.failures) : undefined}
            sublabel={rangeLabel}
            status={syncTotals && syncTotals.failures > 0 ? "critical" : "default"}
            isLoading={sync.status === "loading"}
            error={sync.status === "error" ? sync.error : null}
          />
          <StatTile
            icon={Activity}
            label="Offline queue depth"
            value={typeof averageQueueDepth === "number" ? averageQueueDepth.toFixed(1) : undefined}
            sublabel="Average queued operations"
            isLoading={sync.status === "loading"}
            error={sync.status === "error" ? sync.error : null}
          />
          <StatTile
            icon={ScanLine}
            label="OCR success"
            value={typeof averageOcrRate === "number" ? formatPercent.format(averageOcrRate) : undefined}
            sublabel={rangeLabel}
            isLoading={ocr.status === "loading"}
            error={ocr.status === "error" ? ocr.error : null}
          />
          <StatTile
            icon={CircleAlert}
            label="Authentication errors"
            value="Not connected"
            sublabel="Awaiting auth event telemetry"
          />
          <StatTile
            icon={Gauge}
            label="API latency"
            value="Not connected"
            sublabel="Awaiting server timing telemetry"
          />
          <StatTile
            icon={HardDrive}
            label="Storage usage"
            value="Not connected"
            sublabel="Awaiting storage telemetry"
          />
          <StatTile
            icon={ShieldAlert}
            label="Incident groups"
            value={errors.status === "success" ? formatInteger.format(errors.data.length) : undefined}
            sublabel={rangeLabel}
            status={errors.status === "success" && errors.data.length > 0 ? "critical" : "default"}
            isLoading={errors.status === "loading"}
            error={errors.status === "error" ? errors.error : null}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard<SyncPoint[]>
          title="PowerSync reliability"
          description="Successful sync events and offline queue behavior"
          summary="Line chart showing synchronization success percentage over time."
          url={withDateRange("/api/system/sync-health")}
          exportSource="system/sync-health"
          emptyTitle="No sync failures recorded"
          emptyDescription="This may indicate healthy operation or that sync telemetry has not been connected."
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

        <ChartCard<OcrPoint[]>
          title="Receipt OCR reliability"
          description="Successful text extraction across recorded attempts"
          summary="Line chart showing OCR success percentage over time."
          url={withDateRange("/api/system/ocr-success-rate")}
          exportSource="system/ocr-success-rate"
          emptyTitle="No OCR attempts recorded"
          emptyDescription="OCR telemetry will appear after mobile instrumentation is connected."
        >
          {(data) => (
            <LineTrendChart
              data={data.map((point) => ({
                ...point,
                successRate: point.successRate * 100,
              }))}
              xKey="date"
              yKey="successRate"
              color="var(--series-2)"
              valueFormatter={(value) => `${Math.round(value)}%`}
            />
          )}
        </ChartCard>
      </div>

      <section
        className="min-w-0 rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
        aria-labelledby="incidents-title"
      >
        <div>
          <h2 id="incidents-title" className="text-sm font-semibold">
            Recent operational incidents
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Grouped, sanitized error events. Internal stack traces and database details are never shown.
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
              title="No incidents in this period"
              description="No grouped operational errors were recorded. Continue monitoring or widen the date range."
            />
          ) : null}
          {errors.status === "success" && errors.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <caption className="sr-only">
                  Recent operational incidents grouped by error type and message
                </caption>
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th scope="col" className="px-3 py-2.5 font-medium">Severity</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Last seen</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Safe summary</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Events</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.data.map((row, index) => {
                    const critical = /critical|fatal|auth/i.test(row.errorType);
                    return (
                      <tr key={`${row.timestamp}-${index}`} className="border-b last:border-0">
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium ${
                              critical
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <span className={`size-1.5 rounded-full ${critical ? "bg-destructive" : "bg-foreground"}`} />
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
