"use client";

import {
  BadgeDollarSign,
  Landmark,
  PiggyBank,
  ReceiptText,
  Repeat,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { BarDistributionChart } from "@/components/charts/BarDistributionChart";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { PieBreakdownChart } from "@/components/charts/PieBreakdownChart";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { useDashboardFilters } from "@/components/dashboard/DashboardFilters";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatTile } from "@/components/dashboard/StatTile";
import type { OverviewSummary } from "@/lib/data/overview";
import {
  formatCurrency,
  formatInteger,
  formatNumber,
  formatPercent,
} from "@/lib/formatters";
import { useApiData } from "@/lib/hooks/useApiData";

type BudgetAdherence = {
  pctBudgetsOverLimit: number;
  pctBudgetsUnderLimit: number;
  avgUtilization: number;
};

type SubscriptionsLoans = {
  activeSubscriptions: number;
  totalSubscriptionValueMonthly: number;
  activeLoans: number;
  totalLoanRemaining: number;
};

type TransactionPoint = { date: string; volume: number; count: number };
type AccountType = { accountType: string; count: number };

export default function FinancePage() {
  const { rangeLabel, withDateRange } = useDashboardFilters();
  const budgetAdherence = useApiData<BudgetAdherence>(
    withDateRange("/api/finance/budget-adherence")
  );
  const subscriptionsLoans = useApiData<SubscriptionsLoans>(
    "/api/finance/subscriptions-loans-summary"
  );
  const transactionVolume = useApiData<TransactionPoint[]>(
    withDateRange("/api/finance/transaction-volume")
  );
  const accountTypes = useApiData<AccountType[]>("/api/finance/account-types");
  const overview = useApiData<OverviewSummary>("/api/overview/summary");

  const transactionTotals =
    transactionVolume.status === "success"
      ? transactionVolume.data.reduce(
          (total, row) => ({
            count: total.count + row.count,
            volume: total.volume + row.volume,
          }),
          { count: 0, volume: 0 }
        )
      : undefined;
  const accountTotal =
    accountTypes.status === "success"
      ? accountTypes.data.reduce((total, row) => total + row.count, 0)
      : undefined;
  const accountsPerActiveUser =
    typeof accountTotal === "number" &&
    overview.status === "success" &&
    overview.data.mau > 0
      ? accountTotal / overview.data.mau
      : undefined;

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeading
        eyebrow="Aggregate finance"
        title="Financial activity"
        description={`Analyze anonymized transaction, budget, subscription, loan, and account trends across ${rangeLabel.toLowerCase()}.`}
      />

      <div className="flex items-start gap-3 rounded-lg border bg-muted/35 p-4">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-xs font-medium">Aggregated data only</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Values on this page cannot be traced to an individual user, account, or transaction.
          </p>
        </div>
      </div>

      <section aria-labelledby="finance-kpis">
        <h2 id="finance-kpis" className="sr-only">
          Financial activity key metrics
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={ReceiptText}
            label="Tracked entries"
            value={transactionTotals ? formatNumber.format(transactionTotals.count) : undefined}
            sublabel={rangeLabel}
            isLoading={transactionVolume.status === "loading"}
            error={transactionVolume.status === "error" ? transactionVolume.error : null}
          />
          <StatTile
            icon={BadgeDollarSign}
            label="Tracked volume"
            value={transactionTotals ? formatCurrency.format(transactionTotals.volume) : undefined}
            sublabel={`Across ${transactionTotals ? formatInteger.format(transactionTotals.count) : "—"} entries`}
            isLoading={transactionVolume.status === "loading"}
            error={transactionVolume.status === "error" ? transactionVolume.error : null}
          />
          <StatTile
            icon={PiggyBank}
            label="Budgets over limit"
            value={
              budgetAdherence.status === "success"
                ? formatPercent.format(budgetAdherence.data.pctBudgetsOverLimit)
                : undefined
            }
            sublabel="Configured budget periods"
            isLoading={budgetAdherence.status === "loading"}
            error={budgetAdherence.status === "error" ? budgetAdherence.error : null}
          />
          <StatTile
            icon={TrendingUp}
            label="Avg. budget utilization"
            value={
              budgetAdherence.status === "success"
                ? formatPercent.format(budgetAdherence.data.avgUtilization)
                : undefined
            }
            sublabel="Spend divided by configured limit"
            isLoading={budgetAdherence.status === "loading"}
            error={budgetAdherence.status === "error" ? budgetAdherence.error : null}
          />
          <StatTile
            icon={Repeat}
            label="Active subscriptions"
            value={
              subscriptionsLoans.status === "success"
                ? formatInteger.format(subscriptionsLoans.data.activeSubscriptions)
                : undefined
            }
            sublabel={
              subscriptionsLoans.status === "success"
                ? `${formatCurrency.format(subscriptionsLoans.data.totalSubscriptionValueMonthly)} estimated monthly`
                : undefined
            }
            isLoading={subscriptionsLoans.status === "loading"}
            error={subscriptionsLoans.status === "error" ? subscriptionsLoans.error : null}
          />
          <StatTile
            icon={Landmark}
            label="Active loans"
            value={
              subscriptionsLoans.status === "success"
                ? formatInteger.format(subscriptionsLoans.data.activeLoans)
                : undefined
            }
            sublabel={
              subscriptionsLoans.status === "success" &&
              subscriptionsLoans.data.activeLoans === 0
                ? "Loan telemetry not connected"
                : "Tracked loan products"
            }
            isLoading={subscriptionsLoans.status === "loading"}
            error={subscriptionsLoans.status === "error" ? subscriptionsLoans.error : null}
          />
          <StatTile
            icon={WalletCards}
            label="Tracked accounts"
            value={typeof accountTotal === "number" ? formatInteger.format(accountTotal) : undefined}
            sublabel="Across all account types"
            isLoading={accountTypes.status === "loading"}
            error={accountTypes.status === "error" ? accountTypes.error : null}
          />
          <StatTile
            icon={WalletCards}
            label="Accounts per active user"
            value={
              typeof accountsPerActiveUser === "number"
                ? accountsPerActiveUser.toFixed(1)
                : undefined
            }
            sublabel="Based on trailing MAU"
            tooltip="Total tracked accounts divided by monthly ledger-active users."
            isLoading={accountTypes.status === "loading" || overview.status === "loading"}
            error={
              accountTypes.status === "error"
                ? accountTypes.error
                : overview.status === "error"
                  ? overview.error
                  : null
            }
          />
        </div>
      </section>

      <ChartCard<{ date: string; income: number; expenses: number }[]>
        title="Income versus expenses"
        description={`Aggregated cash-flow direction · ${rangeLabel}`}
        summary="Two-line trend comparing total income and expense amounts over time."
        url={withDateRange("/api/finance/income-expenses")}
      >
        {(data) => (
          <LineTrendChart
            data={data}
            xKey="date"
            series={[
              { key: "income", label: "Income", color: "var(--series-1)" },
              {
                key: "expenses",
                label: "Expenses",
                color: "var(--series-3)",
                dashed: true,
              },
            ]}
            valueFormatter={(value) => formatCurrency.format(value)}
          />
        )}
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard<{ category: string; volume: number; pctOfTotal: number }[]>
          title="Top expense categories"
          description="Ten largest categories by aggregated value"
          summary="Horizontal bars ranking the top expense categories by total tracked amount."
          url={withDateRange("/api/finance/category-distribution")}
          exportSource="finance/category-distribution"
          className="xl:row-span-1"
        >
          {(data) => (
            <BarDistributionChart
              data={data.slice(0, 10)}
              xKey="category"
              yKey="volume"
              horizontal
              valueFormatter={(value) => formatCurrency.format(value)}
            />
          )}
        </ChartCard>

        <ChartCard<AccountType[]>
          title="Account type distribution"
          description="Share of wallets, bank accounts, cash, and other account types"
          summary="Donut chart showing the distribution of tracked account types."
          url="/api/finance/account-types"
          exportSource="finance/account-types"
        >
          {(data) => (
            <PieBreakdownChart data={data} nameKey="accountType" valueKey="count" />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
