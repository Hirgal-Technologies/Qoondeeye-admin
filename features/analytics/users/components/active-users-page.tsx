"use client";

import { Activity, ListChecks, UserCheck, Zap } from "lucide-react";
import { useCallback } from "react";
import { LineTrendChart } from "@/components/charts/lazy";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { useDashboardFilters } from "@/components/dashboard/DashboardFilters";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatTile } from "@/components/dashboard/StatTile";
import {
  UserRosterTable,
  type RosterColumn,
} from "@/components/dashboard/UserRosterTable";
import { StatePanel } from "@/components/states/StatePanel";
import type { ActiveUsersPoint } from "@/features/analytics/overview/contracts";
import type {
  ActiveUserRow,
  ActiveUsersList,
} from "@/features/analytics/users/contracts";
import {
  formatCurrency,
  formatDate,
  formatInteger,
} from "@/lib/formatters";
import { useApiData } from "@/lib/hooks/useApiData";

const ROSTER_LIMIT = 100;

const columns: RosterColumn<ActiveUserRow>[] = [
  {
    key: "name",
    header: "Name",
    className: "font-medium",
    render: (row) => row.fullName ?? "—",
  },
  {
    key: "email",
    header: "Email",
    render: (row) => row.email,
  },
  {
    key: "lastActiveAt",
    header: "Last active",
    className: "whitespace-nowrap text-muted-foreground tabular-nums",
    render: (row) => formatDate(row.lastActiveAt),
  },
  {
    key: "entries",
    header: "Ledger entries",
    className: "tabular-nums",
    render: (row) => formatInteger.format(row.entries),
  },
  {
    key: "volume",
    header: "Volume",
    className: "tabular-nums text-muted-foreground",
    render: (row) => formatCurrency.format(row.volume),
  },
  {
    key: "createdAt",
    header: "Member since",
    className: "whitespace-nowrap text-muted-foreground tabular-nums",
    render: (row) => (row.createdAt ? formatDate(row.createdAt) : "—"),
  },
];

export function ActiveUsersPage({ hasSupportRole }: { hasSupportRole: boolean }) {
  const { rangeLabel, withDateRange } = useDashboardFilters();
  const roster = useApiData<ActiveUsersList>(
    withDateRange("/api/users/active", { limit: String(ROSTER_LIMIT) })
  );

  const searchValues = useCallback(
    (row: ActiveUserRow) => [row.fullName, row.email, row.id],
    []
  );

  if (!hasSupportRole) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading
          eyebrow="Restricted module"
          title="Active users"
          description="The individual activity roster is limited to approved support and administrator roles."
        />
        <StatePanel
          kind="permission"
          title="Support permission required"
          description="Your current role cannot view account-level rosters. Aggregate engagement analytics remain available."
        />
      </div>
    );
  }

  const summary = roster.status === "success" ? roster.data : undefined;
  const averageEntries =
    summary && summary.totalActive > 0
      ? summary.totalEntries / summary.totalActive
      : undefined;
  const mostActive = summary?.users.length
    ? [...summary.users].sort((a, b) => b.entries - a.entries)[0]
    : undefined;

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeading
        eyebrow="Engagement"
        title="Active users"
        description={`Accounts with recorded ledger activity during ${rangeLabel.toLowerCase()}, ranked by most recent activity.`}
      />

      <section aria-labelledby="active-user-kpis">
        <h2 id="active-user-kpis" className="sr-only">
          Active user key metrics
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={UserCheck}
            label="Active users"
            value={summary ? formatInteger.format(summary.totalActive) : undefined}
            sublabel={rangeLabel}
            tooltip="Distinct accounts with at least one ledger entry in the selected range."
            isLoading={roster.status === "loading"}
            error={roster.status === "error" ? roster.error : null}
          />
          <StatTile
            icon={ListChecks}
            label="Ledger entries"
            value={summary ? formatInteger.format(summary.totalEntries) : undefined}
            sublabel="Recorded in this period"
            isLoading={roster.status === "loading"}
            error={roster.status === "error" ? roster.error : null}
          />
          <StatTile
            icon={Activity}
            label="Entries per active user"
            value={
              typeof averageEntries === "number"
                ? averageEntries.toFixed(1)
                : undefined
            }
            sublabel="Average engagement depth"
            tooltip="Total ledger entries divided by the number of active users."
            isLoading={roster.status === "loading"}
            error={roster.status === "error" ? roster.error : null}
          />
          <StatTile
            icon={Zap}
            label="Most active account"
            value={
              mostActive ? `${formatInteger.format(mostActive.entries)} entries` : undefined
            }
            sublabel={mostActive?.email}
            tooltip="Highest entry count among the accounts listed below."
            isLoading={roster.status === "loading"}
            error={roster.status === "error" ? roster.error : null}
          />
        </div>
      </section>

      <ChartCard<ActiveUsersPoint[]>
        title="Daily and monthly active users"
        description={`Distinct ledger-active accounts · ${rangeLabel}`}
        summary="Line chart comparing daily active users with trailing 30-day active users."
        url={withDateRange("/api/overview/active-users")}
        emptyTitle="No activity in this period"
        emptyDescription="Active user counts appear once ledger entries are recorded. Try a wider date range."
      >
        {(data) => (
          <LineTrendChart
            data={data}
            xKey="date"
            series={[
              { key: "dau", label: "Daily active", color: "var(--series-1)" },
              { key: "mau", label: "30-day active", color: "var(--series-2)", dashed: true },
            ]}
            valueFormatter={(value) => formatInteger.format(value)}
          />
        )}
      </ChartCard>

      <UserRosterTable<ActiveUserRow>
        title="Active user roster"
        description="Most recently active accounts first"
        columns={columns}
        rows={summary?.users ?? []}
        rowKey={(row) => row.id}
        searchValues={searchValues}
        searchPlaceholder="Search name or email…"
        isLoading={roster.status === "loading"}
        error={roster.status === "error" ? roster.error : null}
        onRetry={roster.retry}
        errorTitle="Activity roster unavailable"
        emptyTitle="No active users"
        emptyDescription="No account recorded ledger activity in this period. Try a wider date range."
        minWidthClass="min-w-[880px]"
        footer={
          summary && summary.totalActive > summary.users.length
            ? `Showing the ${formatInteger.format(summary.users.length)} most recently active of ${formatInteger.format(summary.totalActive)} accounts.`
            : null
        }
      />
    </div>
  );
}
