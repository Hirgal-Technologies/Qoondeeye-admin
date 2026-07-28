"use client";

import Link from "next/link";
import { CalendarClock, TrendingUp, UserPlus, Users } from "lucide-react";
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
import type {
  NewUserRow,
  NewUsersList,
  SignupPoint,
} from "@/features/analytics/users/contracts";
import { formatDate, formatDateTime, formatInteger } from "@/lib/formatters";
import { useApiData } from "@/lib/hooks/useApiData";

const ROSTER_LIMIT = 100;

const columns: RosterColumn<NewUserRow>[] = [
  {
    key: "name",
    header: "Name",
    className: "font-medium",
    render: (row) => (
      <Link
        href={`/dashboard/transactions/users/${row.id}`}
        prefetch={false}
        className="rounded-sm underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        aria-label={`View details for ${row.fullName ?? row.email}`}
      >
        {row.fullName ?? "Unnamed user"}
      </Link>
    ),
  },
  {
    key: "email",
    header: "Email",
    render: (row) => row.email,
  },
  {
    key: "userType",
    header: "Account type",
    className: "capitalize text-muted-foreground",
    render: (row) => (row.userType ? row.userType.replace(/[_-]/g, " ") : "—"),
  },
  {
    key: "createdAt",
    header: "Signed up",
    className: "whitespace-nowrap text-muted-foreground tabular-nums",
    render: (row) => formatDateTime(row.createdAt),
  },
  {
    key: "id",
    header: "User ID",
    className: "font-mono text-[11px] text-muted-foreground",
    render: (row) => `${row.id.slice(0, 8)}…`,
  },
];

export function NewUsersPage({ hasSupportRole }: { hasSupportRole: boolean }) {
  const { rangeLabel, withDateRange } = useDashboardFilters();
  const roster = useApiData<NewUsersList>(
    withDateRange("/api/users/new", { limit: String(ROSTER_LIMIT) })
  );
  const signups = useApiData<SignupPoint[]>(withDateRange("/api/users/signups"));

  const searchValues = useCallback(
    (row: NewUserRow) => [row.fullName, row.email, row.userType, row.id],
    []
  );

  if (!hasSupportRole) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading
          eyebrow="Restricted module"
          title="New signups"
          description="The individual signup roster is limited to approved support and administrator roles."
        />
        <StatePanel
          kind="permission"
          title="Support permission required"
          description="Your current role cannot view account-level rosters. Aggregate user analytics remain available."
        />
      </div>
    );
  }

  const trend = signups.status === "success" ? signups.data : [];
  const dailyAverage =
    trend.length > 0
      ? trend.reduce((sum, point) => sum + point.count, 0) / trend.length
      : undefined;
  const peak =
    trend.length > 0
      ? trend.reduce((best, point) => (point.count > best.count ? point : best))
      : undefined;
  const latestSignup =
    roster.status === "success" ? roster.data.users[0] : undefined;
  const total = roster.status === "success" ? roster.data.total : undefined;

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeading
        eyebrow="Acquisition"
        title="New signups"
        description={`Every account created during ${rangeLabel.toLowerCase()}, with the running signup total and the newest registrations first.`}
      />

      <section aria-labelledby="new-signup-kpis">
        <h2 id="new-signup-kpis" className="sr-only">
          New signup key metrics
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={UserPlus}
            label="Total new signups"
            value={typeof total === "number" ? formatInteger.format(total) : undefined}
            sublabel={rangeLabel}
            tooltip="Profiles created during the selected date range."
            isLoading={roster.status === "loading"}
            error={roster.status === "error" ? roster.error : null}
          />
          <StatTile
            icon={TrendingUp}
            label="Average per interval"
            value={
              typeof dailyAverage === "number"
                ? formatInteger.format(Math.round(dailyAverage))
                : undefined
            }
            sublabel="Across reporting intervals with signups"
            tooltip="Mean signups per bucket of the signup trend (day or week, set by the selected range)."
            isLoading={signups.status === "loading"}
            error={signups.status === "error" ? signups.error : null}
          />
          <StatTile
            icon={Users}
            label="Peak interval"
            value={peak ? formatInteger.format(peak.count) : undefined}
            sublabel={peak ? formatDate(peak.date) : undefined}
            tooltip="Highest number of signups recorded in a single interval."
            isLoading={signups.status === "loading"}
            error={signups.status === "error" ? signups.error : null}
          />
          <StatTile
            icon={CalendarClock}
            label="Most recent signup"
            value={latestSignup ? formatDateTime(latestSignup.createdAt) : undefined}
            sublabel={latestSignup?.email}
            isLoading={roster.status === "loading"}
            error={roster.status === "error" ? roster.error : null}
          />
        </div>
      </section>

      <ChartCard<SignupPoint[]>
        title="Signup trend"
        description={`New profiles created · ${rangeLabel}`}
        summary="Line chart of new user signups over the selected period."
        url={withDateRange("/api/users/signups")}
        exportSource="users/signups"
        emptyTitle="No new users"
        emptyDescription="No profiles were created in this period. Try a wider date range."
      >
        {(data) => (
          <LineTrendChart
            data={data}
            xKey="date"
            yKey="count"
            valueFormatter={(value) => formatInteger.format(value)}
          />
        )}
      </ChartCard>

      <UserRosterTable<NewUserRow>
        title="New user roster"
        description="Newest registrations first"
        columns={columns}
        rows={roster.status === "success" ? roster.data.users : []}
        rowKey={(row) => row.id}
        searchValues={searchValues}
        searchPlaceholder="Search name, email, account type…"
        isLoading={roster.status === "loading"}
        error={roster.status === "error" ? roster.error : null}
        onRetry={roster.retry}
        errorTitle="Signup roster unavailable"
        emptyTitle="No new users"
        emptyDescription="No accounts were created in this period. Try a wider date range."
        footer={
          roster.status === "success" && roster.data.total > roster.data.users.length
            ? `Showing the ${formatInteger.format(roster.data.users.length)} most recent of ${formatInteger.format(roster.data.total)} signups. Narrow the date range to see the rest.`
            : null
        }
      />
    </div>
  );
}
