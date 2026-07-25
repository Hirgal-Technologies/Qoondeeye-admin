"use client";

import {
  Activity,
  ChartNoAxesCombined,
  CircleCheck,
  RefreshCcw,
  Repeat2,
  ShieldCheck,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import { BarDistributionChart, LineTrendChart } from "@/components/charts/lazy";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { useDashboardFilters } from "@/components/dashboard/DashboardFilters";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatTile } from "@/components/dashboard/StatTile";
import {
  formatCurrency,
  formatInteger,
  formatNumber,
  formatPercent,
} from "@/lib/formatters";
import { useApiData } from "@/lib/hooks/useApiData";
import type {
  ActiveUsersPoint,
  OverviewSummary,
  RetentionPoint,
} from "@/features/analytics/overview/contracts";

type SyncPoint = {
  date: string;
  successRate: number;
  avgQueueDepth: number;
  failures: number;
};

export function OverviewPage() {
  const { days, rangeLabel, withDateRange } = useDashboardFilters();
  const summary = useApiData<OverviewSummary>("/api/overview/summary");
  const retention = useApiData<RetentionPoint[]>(
    `/api/overview/retention?cohortWindow=${days}`
  );
  const sync = useApiData<SyncPoint[]>(withDateRange("/api/system/sync-health"));

  const loading = summary.status === "loading";
  const summaryError = summary.status === "error" ? summary.error : null;
  const retentionD7 =
    retention.status === "success"
      ? retention.data.find((point) => point.day === 7)?.retentionPct
      : undefined;
  const syncSuccess =
    sync.status === "success" && sync.data.length
      ? sync.data.reduce((total, point) => total + point.successRate, 0) /
        sync.data.length
      : undefined;

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeading
        eyebrow="Executive overview"
        title="Business at a glance"
        description={`Aggregated growth, engagement, financial activity, and platform reliability. Charts reflect ${rangeLabel.toLowerCase()}.`}
        actions={
          <span className="inline-flex min-h-9 items-center gap-2 rounded-md border bg-card px-3 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-foreground" />
            Live aggregate data
          </span>
        }
      />

      <section aria-labelledby="overview-kpis">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 id="overview-kpis" className="text-sm font-semibold">
              Key performance indicators
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Windows are stated per metric to avoid false comparisons.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={Users}
            label="Total users"
            value={summary.status === "success" ? formatInteger.format(summary.data.totalUsers) : undefined}
            change={{ value: "All time", direction: "neutral", label: "registered" }}
            tooltip="All profiles with an active Qoondeeye account."
            isLoading={loading}
            error={summaryError}
          />
          <StatTile
            icon={UserPlus}
            label="New users"
            value={summary.status === "success" ? formatInteger.format(summary.data.newUsers30d) : undefined}
            sublabel={
              summary.status === "success"
                ? `${formatInteger.format(summary.data.newUsers7d)} in the last 7 days`
                : undefined
            }
            tooltip="New profiles created in the last 30 days."
            isLoading={loading}
            error={summaryError}
          />
          <StatTile
            icon={Activity}
            label="Daily active users"
            value={summary.status === "success" ? formatInteger.format(summary.data.dau) : undefined}
            sublabel="Ledger-active users, trailing day"
            tooltip="Distinct users who recorded ledger activity in the last day. Session telemetry is not yet connected."
            isLoading={loading}
            error={summaryError}
          />
          <StatTile
            icon={Users}
            label="Monthly active users"
            value={summary.status === "success" ? formatInteger.format(summary.data.mau) : undefined}
            sublabel="Ledger-active users, trailing 30 days"
            tooltip="Distinct users who recorded ledger activity in the last 30 days."
            isLoading={loading}
            error={summaryError}
          />
          <StatTile
            icon={Repeat2}
            label="DAU / MAU ratio"
            value={
              summary.status === "success"
                ? formatPercent.format(
                    summary.data.mau === 0 ? 0 : summary.data.dau / summary.data.mau
                  )
                : undefined
            }
            sublabel="Daily engagement depth"
            tooltip="Daily active users divided by monthly active users."
            isLoading={loading}
            error={summaryError}
          />
          <StatTile
            icon={WalletCards}
            label="Tracked volume"
            value={
              summary.status === "success"
                ? formatCurrency.format(summary.data.totalTransactionVolume30d)
                : undefined
            }
            sublabel={
              summary.status === "success"
                ? `${formatNumber.format(summary.data.totalTransactionCount30d)} entries · 30 days`
                : undefined
            }
            tooltip="Aggregated ledger amount tracked during the last 30 days. No individual transactions are exposed."
            isLoading={loading}
            error={summaryError}
          />
          <StatTile
            icon={ChartNoAxesCombined}
            label="Day 7 retention"
            value={typeof retentionD7 === "number" ? formatPercent.format(retentionD7) : undefined}
            sublabel={`Signup cohorts · ${days} day window`}
            tooltip="Share of eligible signup cohorts with ledger activity on or after day seven."
            isLoading={retention.status === "loading"}
            error={retention.status === "error" ? retention.error : null}
          />
          <StatTile
            icon={syncSuccess === undefined ? RefreshCcw : CircleCheck}
            label="Sync success rate"
            value={typeof syncSuccess === "number" ? formatPercent.format(syncSuccess) : undefined}
            sublabel={sync.data?.length ? rangeLabel : "Waiting for mobile telemetry"}
            tooltip="Successful PowerSync events divided by all recorded sync attempts."
            isLoading={sync.status === "loading"}
            error={sync.status === "error" ? sync.error : null}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard<{ date: string; count: number }[]>
          title="User growth"
          description={`New Qoondeeye registrations · ${rangeLabel}`}
          summary="Line chart showing new registrations over the selected date range."
          url={withDateRange("/api/users/signups")}
          exportSource="users/signups"
          exportParams={{ granularity: days === 90 ? "week" : "day" }}
        >
          {(data) => (
            <LineTrendChart
              data={data}
              xKey="date"
              yKey="count"
              valueFormatter={(value) => formatNumber.format(value)}
            />
          )}
        </ChartCard>

        <ChartCard<ActiveUsersPoint[]>
          title="Active users"
          description="DAU and trailing MAU based on anonymized ledger activity"
          summary="DAU and MAU trend. Monthly active users remain above daily active users throughout the period."
          url={withDateRange("/api/overview/active-users")}
        >
          {(data) => (
            <LineTrendChart
              data={data}
              xKey="date"
              series={[
                { key: "mau", label: "MAU", color: "var(--series-3)" },
                { key: "dau", label: "DAU", color: "var(--series-1)" },
              ]}
              valueFormatter={(value) => formatNumber.format(value)}
            />
          )}
        </ChartCard>

        <ChartCard<RetentionPoint[]>
          title="Retention curve"
          description="Eligible signup cohorts active on or after day 1, 7, and 30"
          summary="Retention comparison across day one, day seven, and day thirty."
          url={`/api/overview/retention?cohortWindow=${days}`}
          exportSource="overview/retention"
          exportParams={{ cohortWindow: String(days) }}
        >
          {(data) => (
            <BarDistributionChart
              data={data.map((point) => ({
                day: `D${point.day}`,
                retentionPct: point.retentionPct * 100,
              }))}
              xKey="day"
              yKey="retentionPct"
              valueFormatter={(value) => `${Math.round(value)}%`}
            />
          )}
        </ChartCard>

        <ChartCard<{ date: string; volume: number; count: number }[]>
          title="Financial activity"
          description="Aggregated tracked amount; no individual financial records"
          summary="Line chart of total tracked financial activity over the selected range."
          url={withDateRange("/api/finance/transaction-volume")}
          exportSource="finance/transaction-volume"
          exportParams={{ granularity: days === 90 ? "week" : "day" }}
        >
          {(data) => (
            <LineTrendChart
              data={data}
              xKey="date"
              yKey="volume"
              valueFormatter={(value) => formatCurrency.format(value)}
            />
          )}
        </ChartCard>
      </div>

      <div className="flex items-start gap-3 rounded-lg border bg-muted/35 p-4">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-xs font-medium">Privacy-safe by default</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            This overview uses aggregated, anonymized activity. Individual user financial records
            never appear in general analytics views.
          </p>
        </div>
      </div>
    </div>
  );
}
