"use client";

import {
  LogIn,
  TrendingDown,
  UserMinus,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { LineTrendChart, PieBreakdownChart } from "@/components/charts/lazy";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { useDashboardFilters } from "@/components/dashboard/DashboardFilters";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatTile } from "@/components/dashboard/StatTile";
import { StatePanel } from "@/components/states/StatePanel";
import type {
  AuthMethodPoint,
  ChurnSummary,
  CohortRetentionRow,
  SignupPoint,
} from "@/features/analytics/users/contracts";
import { formatInteger, formatPercent } from "@/lib/formatters";
import { useApiData } from "@/lib/hooks/useApiData";

export function UsersPage() {
  const { days, rangeLabel, withDateRange } = useDashboardFilters();
  const churn = useApiData<ChurnSummary>(
    "/api/users/churn?inactiveDays=30"
  );
  const cohort = useApiData<CohortRetentionRow[]>(
    withDateRange("/api/users/cohort-retention")
  );
  const signups = useApiData<SignupPoint[]>(withDateRange("/api/users/signups"));
  const authMethods = useApiData<AuthMethodPoint[]>("/api/users/auth-methods");

  const signupTotal =
    signups.status === "success"
      ? signups.data.reduce((total, point) => total + point.count, 0)
      : undefined;
  const dominantAuth =
    authMethods.status === "success"
      ? [...authMethods.data].sort((a, b) => b.count - a.count)[0]
      : undefined;

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeading
        eyebrow="Product analytics"
        title="User analytics"
        description={`Understand acquisition, authentication, engagement, retention, and churn across ${rangeLabel.toLowerCase()}.`}
      />

      <section aria-labelledby="user-kpis">
        <h2 id="user-kpis" className="sr-only">
          User analytics key metrics
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={UserPlus}
            label="New signups"
            value={typeof signupTotal === "number" ? formatInteger.format(signupTotal) : undefined}
            sublabel={rangeLabel}
            tooltip="Profiles created during the selected date range."
            isLoading={signups.status === "loading"}
            error={signups.status === "error" ? signups.error : null}
          />
          <StatTile
            icon={UserMinus}
            label="Churned users"
            value={churn.status === "success" ? formatInteger.format(churn.data.churnedCount) : undefined}
            sublabel="No ledger activity for 30 days"
            tooltip="Users without recorded ledger activity in the trailing 30-day window."
            isLoading={churn.status === "loading"}
            error={churn.status === "error" ? churn.error : null}
          />
          <StatTile
            icon={TrendingDown}
            label="Churn indicator"
            value={churn.status === "success" ? formatPercent.format(churn.data.churnedPct) : undefined}
            sublabel="Share of all registered users"
            isLoading={churn.status === "loading"}
            error={churn.status === "error" ? churn.error : null}
          />
          <StatTile
            icon={LogIn}
            label="Leading auth method"
            value={dominantAuth?.method ? formatMethod(dominantAuth.method) : undefined}
            sublabel={
              dominantAuth
                ? `${formatInteger.format(dominantAuth.count)} registered identities`
                : undefined
            }
            tooltip="Most common Supabase identity provider across registered accounts."
            isLoading={authMethods.status === "loading"}
            error={authMethods.status === "error" ? authMethods.error : null}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard<SignupPoint[]>
          title="Signup trend"
          description={`New profiles created · ${rangeLabel}`}
          summary="Line chart of new user signups over the selected period."
          url={withDateRange("/api/users/signups")}
          exportSource="users/signups"
          exportParams={{ granularity: days === 90 ? "week" : "day" }}
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

        <ChartCard<AuthMethodPoint[]>
          title="Authentication methods"
          description="Distribution across configured identity providers"
          summary="Donut chart showing the relative use of each authentication method."
          url="/api/users/auth-methods"
          exportSource="users/auth-methods"
          emptyTitle="No authentication identities"
          emptyDescription="Authentication providers will appear after the first user is registered."
        >
          {(data) => (
            <PieBreakdownChart data={data} nameKey="method" valueKey="count" />
          )}
        </ChartCard>
      </div>

      <section
        className="min-w-0 rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
        aria-labelledby="cohort-title"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="cohort-title" className="text-sm font-semibold">
              Weekly cohort retention
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Percentage of each signup cohort with ledger activity during weeks 0–4.
            </p>
          </div>
          <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground sm:mt-0">
            <UsersRound aria-hidden="true" className="size-3" />
            Activity proxy
          </span>
        </div>

        <div className="mt-4">
          {cohort.status === "loading" ? <CohortSkeleton /> : null}
          {cohort.status === "error" ? (
            <StatePanel
              compact
              kind="error"
              title="Cohort data unavailable"
              description={cohort.error}
              actionLabel="Retry"
              onAction={cohort.retry}
            />
          ) : null}
          {cohort.status === "success" && cohort.data.length === 0 ? (
            <StatePanel
              compact
              title="No eligible cohorts"
              description="No signup cohorts are old enough to measure in this period. Try a wider range."
            />
          ) : null}
          {cohort.status === "success" && cohort.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-separate border-spacing-1 text-xs tabular-nums">
                <caption className="sr-only">
                  Weekly cohort retention percentages for weeks zero through four
                </caption>
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">
                      Signup cohort
                    </th>
                    {[0, 1, 2, 3, 4].map((week) => (
                      <th
                        scope="col"
                        key={week}
                        className="px-2 py-2 text-center font-medium text-muted-foreground"
                      >
                        Week {week}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohort.data.map((row) => (
                    <tr key={row.cohort}>
                      <th
                        scope="row"
                        className="whitespace-nowrap rounded-md bg-muted/60 px-2 py-2.5 text-left font-medium text-foreground"
                      >
                        {row.cohort}
                      </th>
                      {[0, 1, 2, 3, 4].map((week) => {
                        const value = row[`week${week}`];
                        return (
                          <td
                            key={week}
                            className={`rounded-md px-2 py-2.5 text-center font-medium ${retentionCellClass(value)}`}
                            aria-label={
                              typeof value === "number"
                                ? `Week ${week}: ${formatPercent.format(value)} retained`
                                : `Week ${week}: not yet eligible`
                            }
                          >
                            {typeof value === "number" ? formatPercent.format(value) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function formatMethod(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function retentionCellClass(value: number | string) {
  if (typeof value !== "number") return "bg-muted/35 text-muted-foreground";
  if (value >= 0.65) return "bg-primary text-primary-foreground";
  if (value >= 0.4) return "bg-foreground/75 text-background";
  if (value >= 0.2) return "bg-foreground/30 text-foreground";
  return "bg-muted text-muted-foreground";
}

function CohortSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading retention cohorts">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="grid grid-cols-6 gap-2">
          {[0, 1, 2, 3, 4, 5].map((cell) => (
            <div key={cell} className="skeleton h-9 rounded-md" />
          ))}
        </div>
      ))}
    </div>
  );
}
