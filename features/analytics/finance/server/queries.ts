import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import type {
  DateRangeParams,
  Granularity,
  TxType,
} from "@/features/analytics/shared/contracts";

function truncKey(dateStr: string, granularity: Granularity) {
  const d = new Date(dateStr);
  if (granularity === "day") return d.toISOString().slice(0, 10);
  if (granularity === "month") return d.toISOString().slice(0, 7) + "-01";
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

// `expenses` is the single ledger table (no separate transactions table).
// `entry_type` distinguishes expense/income/transfer; `date` is the
// user-facing transaction date (not `created_at`, which is row-insert time).

export async function getTransactionVolume(
  params: DateRangeParams & { granularity: Granularity; type?: TxType }
): Promise<{ date: string; volume: number; count: number }[]> {
  const db = createAdminClient();
  const data = await fetchAllPages<{
    id: string;
    date: string;
    amount: number | null;
    entry_type: string | null;
  }>((from, to) => {
    let query = db
      .from("expenses")
      .select("id, date, amount, entry_type")
      .gte("date", params.from.slice(0, 10))
      .lte("date", params.to.slice(0, 10));
    if (params.type) query = query.ilike("entry_type", params.type);
    return query.order("date").order("id").range(from, to);
  });

  const buckets = new Map<string, { volume: number; count: number }>();
  for (const row of data) {
    const key = truncKey(row.date, params.granularity);
    const bucket = buckets.get(key) ?? { volume: 0, count: 0 };
    bucket.volume += Number(row.amount ?? 0);
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}

export async function getIncomeExpenseTrend(
  params: DateRangeParams & { granularity: Granularity }
): Promise<{ date: string; income: number; expenses: number }[]> {
  const db = createAdminClient();
  const data = await fetchAllPages<{
    id: string;
    date: string;
    amount: number | null;
    entry_type: string | null;
  }>((from, to) =>
    db
      .from("expenses")
      .select("id, date, amount, entry_type")
      .or("entry_type.ilike.income,entry_type.ilike.expense")
      .gte("date", params.from.slice(0, 10))
      .lte("date", params.to.slice(0, 10))
      .order("date")
      .order("id")
      .range(from, to)
  );

  const buckets = new Map<string, { income: number; expenses: number }>();
  for (const row of data) {
    const key = truncKey(row.date, params.granularity);
    const bucket = buckets.get(key) ?? { income: 0, expenses: 0 };
    const amount = Number(row.amount ?? 0);
    const entryType = row.entry_type?.toLowerCase();
    if (entryType === "income") bucket.income += amount;
    if (entryType === "expense") bucket.expenses += amount;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));
}

export async function getCategoryDistribution(
  params: DateRangeParams
): Promise<{ category: string; volume: number; pctOfTotal: number }[]> {
  const db = createAdminClient();
  const data = await fetchAllPages<{
    id: string;
    category: string | null;
    amount: number | null;
  }>((from, to) =>
    db
      .from("expenses")
      .select("id, category, amount")
      .ilike("entry_type", "expense")
      .gte("date", params.from.slice(0, 10))
      .lte("date", params.to.slice(0, 10))
      .order("id")
      .range(from, to)
  );

  const buckets = new Map<string, number>();
  let total = 0;
  for (const row of data) {
    const category = row.category ?? "uncategorized";
    const amount = Number(row.amount ?? 0);
    buckets.set(category, (buckets.get(category) ?? 0) + amount);
    total += amount;
  }
  return [...buckets.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([category, volume]) => ({
      category,
      volume,
      pctOfTotal: total === 0 ? 0 : volume / total,
    }));
}

/**
 * budget_period_history already tracks amount (limit) vs spent per period —
 * use it directly instead of recomputing from budgets + expenses.
 */
export async function getBudgetAdherence(
  params: DateRangeParams
): Promise<{ pctBudgetsOverLimit: number; pctBudgetsUnderLimit: number; avgUtilization: number }> {
  const db = createAdminClient();
  const periods = await fetchAllPages<{
    amount: number | null;
    spent: number | null;
  }>((from, to) =>
    db
      .from("budget_period_history")
      .select("amount, spent")
      .gte("period_start", params.from.slice(0, 10))
      .lte("period_start", params.to.slice(0, 10))
      .order("id")
      .range(from, to)
  );

  if (periods.length === 0) {
    return { pctBudgetsOverLimit: 0, pctBudgetsUnderLimit: 0, avgUtilization: 0 };
  }

  let over = 0;
  let utilizationSum = 0;
  for (const p of periods) {
    const limit = Number(p.amount ?? 0);
    const spent = Number(p.spent ?? 0);
    if (limit > 0) utilizationSum += spent / limit;
    if (spent > limit) over += 1;
  }

  return {
    pctBudgetsOverLimit: over / periods.length,
    pctBudgetsUnderLimit: (periods.length - over) / periods.length,
    avgUtilization: utilizationSum / periods.length,
  };
}

export async function getAccountTypeDistribution(): Promise<
  { accountType: string; count: number }[]
> {
  const db = createAdminClient();
  // Archived accounts are hidden in the app, so they don't count as tracked.
  const data = await fetchAllPages<{ account_type: string | null }>((from, to) =>
    db
      .from("accounts")
      .select("account_type")
      .is("archived_at", null)
      .order("id")
      .range(from, to)
  );

  const buckets = new Map<string, number>();
  for (const row of data) {
    const type = row.account_type ?? "unknown";
    buckets.set(type, (buckets.get(type) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([accountType, count]) => ({ accountType, count }));
}

const MONTHLY_FACTOR: Record<string, number> = {
  monthly: 1,
  yearly: 1 / 12,
  quarterly: 1 / 3,
  weekly: 52 / 12,
  daily: 365 / 12,
};

// A loan stays open until it is settled; `partial` means partly repaid.
const OPEN_LOAN_STATUSES = ["active", "partial"];

/**
 * Reads the app's own `subscriptions` and `personal_loans` tables: active
 * subscriptions normalized to a monthly amount by billing cycle, and open
 * loans (given or taken) with their outstanding balance.
 */
export async function getSubscriptionsLoansSummary(): Promise<{
  activeSubscriptions: number;
  totalSubscriptionValueMonthly: number;
  activeLoans: number;
  totalLoanRemaining: number;
}> {
  const db = createAdminClient();
  const [subscriptions, loans] = await Promise.all([
    fetchAllPages<{ amount: number | string | null; billing_cycle: string | null }>(
      (from, to) =>
        db
          .from("subscriptions")
          .select("amount, billing_cycle")
          .eq("is_active", true)
          .order("id")
          .range(from, to)
    ),
    fetchAllPages<{ remaining_amount: number | string | null }>((from, to) =>
      db
        .from("personal_loans")
        .select("remaining_amount")
        .in("status", OPEN_LOAN_STATUSES)
        .order("id")
        .range(from, to)
    ),
  ]);

  const totalSubscriptionValueMonthly = subscriptions.reduce((sum, row) => {
    const factor = MONTHLY_FACTOR[row.billing_cycle?.toLowerCase() ?? ""] ?? 1;
    return sum + Number(row.amount ?? 0) * factor;
  }, 0);

  return {
    activeSubscriptions: subscriptions.length,
    totalSubscriptionValueMonthly,
    activeLoans: loans.length,
    totalLoanRemaining: loans.reduce(
      (sum, row) => sum + Number(row.remaining_amount ?? 0),
      0
    ),
  };
}
