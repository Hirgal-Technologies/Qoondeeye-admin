"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  FilterX,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import FinanceDateFilters from "@/components/finance/FinanceDateFilters";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { StatePanel } from "@/components/states/StatePanel";
import { useDashboardFilters } from "@/components/dashboard/DashboardFilters";
import type {
  TransactionRow,
  TransactionsResult,
  TransactionUserOption,
} from "@/features/transactions/contracts";
import { formatDate, formatInteger } from "@/lib/formatters";
import { useApiData } from "@/lib/hooks/useApiData";

const transactionCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function TransactionsPage({
  hasAdminRole,
}: {
  hasAdminRole: boolean;
}) {
  if (!hasAdminRole) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading
          eyebrow="Restricted module"
          title="Transactions"
          description="Individual ledger records are limited to administrators."
        />
        <StatePanel
          kind="permission"
          title="Administrator permission required"
          description="Your current role can view aggregate financial analytics, but not user-level transaction details."
        />
      </div>
    );
  }

  return <AuthorizedTransactionsPage />;
}

function AuthorizedTransactionsPage() {
  const { fromDate, toDate, rangeLabel, withDateRange } =
    useDashboardFilters();
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [type, setType] = useState("");
  const rangeKey = `${fromDate}:${toDate}`;
  const [pagination, setPagination] = useState({ page: 1, rangeKey });
  const [pageSize, setPageSize] = useState(50);
  const page = pagination.rangeKey === rangeKey ? pagination.page : 1;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(draftSearch.trim());
      setPagination({ page: 1, rangeKey });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draftSearch, rangeKey]);

  const url = useMemo(
    () =>
      withDateRange("/api/transactions", {
        page: String(page),
        pageSize: String(pageSize),
        ...(search ? { search } : {}),
        ...(userId ? { userId } : {}),
        ...(type ? { type } : {}),
      }),
    [page, pageSize, search, type, userId, withDateRange],
  );
  const result = useApiData<TransactionsResult>(url);

  const data = result.status === "success" ? result.data : null;
  const users = data?.users ?? [];
  const hasFilters = Boolean(draftSearch || userId || type);

  function clearFilters() {
    setDraftSearch("");
    setSearch("");
    setUserId("");
    setType("");
    setPagination({ page: 1, rangeKey });
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeading
        eyebrow="Ledger operations"
        title="Transactions"
        description="Find a user's transactions here instead of searching and filtering the Supabase table manually."
      />

      <FinanceDateFilters />

      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-muted/45 p-4">
        <ShieldAlert
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-warning"
        />
        <div>
          <p className="text-xs font-medium">Private financial data</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Use this page only for authorized operational work. Results contain
            user identity and individual ledger details.
          </p>
        </div>
      </div>

      <section
        className="overflow-hidden rounded-lg border bg-card"
        aria-labelledby="transaction-list-title"
      >
        <div className="border-b p-4 sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="transaction-list-title" className="text-sm font-semibold">
                Transaction list
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {data
                  ? `${formatInteger.format(data.total)} matching records · ${rangeLabel}`
                  : `Loading records · ${rangeLabel}`}
              </p>
            </div>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary sm:mt-0"
              >
                <FilterX aria-hidden="true" className="size-4" />
                Clear filters
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(16rem,1fr)_minmax(14rem,0.8fr)_12rem]">
            <label>
              <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
                Search
              </span>
              <span className="relative block">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={draftSearch}
                  onChange={(event) => setDraftSearch(event.target.value)}
                  className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
                  placeholder="Name, email, description, category, or ID"
                />
              </span>
            </label>

            <label>
              <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
                User
              </span>
              <select
                value={userId}
                onChange={(event) => {
                  setUserId(event.target.value);
                  setPagination({ page: 1, rangeKey });
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
              >
                <option value="">All users</option>
                {users.map((user) => (
                  <option value={user.id} key={user.id}>
                    {userLabel(user)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
                Type
              </span>
              <select
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                  setPagination({ page: 1, rangeKey });
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-xs capitalize outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
              >
                <option value="">All types</option>
                {(data?.types ?? [
                  "expense",
                  "income",
                  "balance_adjustment",
                ]).map((value) => (
                  <option value={value} key={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {result.status === "loading" ? <TransactionTableSkeleton /> : null}
          {result.status === "error" ? (
            <StatePanel
              compact
              kind="error"
              title="Transactions could not be loaded"
              description={result.error}
              actionLabel="Retry"
              onAction={result.retry}
            />
          ) : null}
          {data && data.rows.length === 0 ? (
            <StatePanel
              compact
              title="No matching transactions"
              description="Try a different user, search term, type, or date range."
              actionLabel={hasFilters ? "Clear filters" : undefined}
              onAction={hasFilters ? clearFilters : undefined}
            />
          ) : null}
          {data && data.rows.length > 0 ? (
            <>
              <TransactionTable rows={data.rows} />
              <TransactionPagination
                data={data}
                pageSize={pageSize}
                onPageSizeChange={(value) => {
                  setPageSize(value);
                  setPagination({ page: 1, rangeKey });
                }}
                onPrevious={() =>
                  setPagination({
                    page: Math.max(page - 1, 1),
                    rangeKey,
                  })
                }
                onNext={() =>
                  setPagination({
                    page: Math.min(page + 1, data.totalPages),
                    rangeKey,
                  })
                }
              />
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function TransactionTable({ rows }: { rows: TransactionRow[] }) {
  return (
    <div className="max-h-[38rem] overflow-auto rounded-md border">
      <table className="w-full min-w-[980px] text-left text-xs">
        <caption className="sr-only">
          Individual transactions and their associated users
        </caption>
        <thead className="sticky top-0 z-10">
          <tr className="border-b bg-[hsl(var(--surface-table-head))] text-muted-foreground">
            <th scope="col" className="px-3 py-2.5 font-medium">
              Date
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              User
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Description
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Category
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Type
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">
              Amount
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Transaction ID
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id}
              className={`border-b transition-colors last:border-0 hover:bg-[hsl(var(--surface-table-hover))] ${
                index % 2 === 1
                  ? "bg-[hsl(var(--surface-table-row-alt))]"
                  : ""
              }`}
            >
              <td className="whitespace-nowrap px-3 py-3 tabular-nums text-muted-foreground">
                {formatDate(row.date)}
              </td>
              <td className="max-w-60 px-3 py-3">
                <Link
                  href={`/dashboard/transactions/users/${row.userId}`}
                  className="group/user block rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  aria-label={`View details for ${row.user?.fullName ?? row.user?.email ?? row.userId}`}
                >
                  <span className="block truncate font-medium underline-offset-4 group-hover/user:underline">
                    {row.user?.fullName ?? row.user?.email ?? "Unknown user"}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground group-hover/user:text-primary">
                    {row.user?.email ?? row.userId}
                  </span>
                </Link>
              </td>
              <td className="max-w-72 px-3 py-3">
                <p className="truncate" title={row.description ?? undefined}>
                  {row.description ?? "—"}
                </p>
                {row.isRecurring ? (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Recurring
                    {row.recurrenceInterval
                      ? ` · ${formatLabel(row.recurrenceInterval)}`
                      : ""}
                  </p>
                ) : null}
              </td>
              <td className="max-w-44 px-3 py-3">
                <span className="block truncate" title={row.category ?? undefined}>
                  {displayCategory(row.category)}
                </span>
              </td>
              <td className="px-3 py-3">
                <TransactionTypeBadge type={row.type} />
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">
                {transactionCurrency.format(row.amount)}
              </td>
              <td
                className="max-w-36 truncate px-3 py-3 font-mono text-[11px] text-muted-foreground"
                title={row.id}
              >
                {shortId(row.id)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransactionPagination({
  data,
  pageSize,
  onPageSizeChange,
  onPrevious,
  onNext,
}: {
  data: TransactionsResult;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const first = (data.page - 1) * data.pageSize + 1;
  const last = Math.min(data.page * data.pageSize, data.total);

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11px] text-muted-foreground">
        Showing {formatInteger.format(first)}–{formatInteger.format(last)} of{" "}
        {formatInteger.format(data.total)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          Rows
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-md border bg-background px-2 text-xs text-foreground"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <span className="mx-1 text-[11px] text-muted-foreground">
          Page {formatInteger.format(data.page)} of{" "}
          {formatInteger.format(data.totalPages)}
        </span>
        <button
          type="button"
          onClick={onPrevious}
          disabled={data.page <= 1}
          className="grid size-9 place-items-center rounded-md border bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous transaction page"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={data.page >= data.totalPages}
          className="grid size-9 place-items-center rounded-md border bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next transaction page"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}

function TransactionTableSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading transactions">
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <div className="skeleton h-12 rounded-md" key={row} />
      ))}
    </div>
  );
}

function TransactionTypeBadge({ type }: { type: string }) {
  const normalized = type.toLowerCase();
  const classes =
    normalized === "income"
      ? "bg-success-muted text-success"
      : normalized === "expense"
        ? "bg-critical-muted text-critical"
        : "bg-warning-muted text-warning";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${classes}`}
    >
      {formatLabel(type)}
    </span>
  );
}

function userLabel(user: TransactionUserOption) {
  return user.fullName ? `${user.fullName} — ${user.email}` : user.email;
}

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function displayCategory(category: string | null) {
  if (!category) return "Uncategorized";
  if (category.startsWith("custom_")) {
    return `Custom · ${category.slice("custom_".length, 15)}`;
  }
  return formatLabel(category);
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
