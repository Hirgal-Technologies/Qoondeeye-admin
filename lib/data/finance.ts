import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DateRangeParams, Granularity, TxType } from "@/lib/data/types";

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
  let query = db
    .from("expenses")
    .select("date, amount, entry_type")
    .gte("date", params.from.slice(0, 10))
    .lte("date", params.to.slice(0, 10));
  if (params.type) query = query.eq("entry_type", params.type);

  const { data } = await query;

  const buckets = new Map<string, { volume: number; count: number }>();
  for (const row of data ?? []) {
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
  const { data } = await db
    .from("expenses")
    .select("date, amount, entry_type")
    .in("entry_type", ["income", "expense"])
    .gte("date", params.from.slice(0, 10))
    .lte("date", params.to.slice(0, 10));

  const buckets = new Map<string, { income: number; expenses: number }>();
  for (const row of data ?? []) {
    const key = truncKey(row.date, params.granularity);
    const bucket = buckets.get(key) ?? { income: 0, expenses: 0 };
    const amount = Number(row.amount ?? 0);
    if (row.entry_type === "income") bucket.income += amount;
    if (row.entry_type === "expense") bucket.expenses += amount;
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
  const { data } = await db
    .from("expenses")
    .select("category, amount")
    .eq("entry_type", "expense")
    .gte("date", params.from.slice(0, 10))
    .lte("date", params.to.slice(0, 10));

  const buckets = new Map<string, number>();
  let total = 0;
  for (const row of data ?? []) {
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
  const { data } = await db
    .from("budget_period_history")
    .select("amount, spent, period_start")
    .gte("period_start", params.from.slice(0, 10))
    .lte("period_start", params.to.slice(0, 10));

  const periods = data ?? [];
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
  const { data } = await db.from("accounts").select("account_type");

  const buckets = new Map<string, number>();
  for (const row of data ?? []) {
    const type = row.account_type ?? "unknown";
    buckets.set(type, (buckets.get(type) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([accountType, count]) => ({ accountType, count }));
}

/**
 * No confirmed `subscriptions`/`loans` tables exist in this schema yet
 * (only `app_access_subscriptions`, which is the app's own paywall, not a
 * user-tracked bill/loan feature). Proxying "subscriptions" as recurring
 * expenses (`is_recurring = true`) until/unless a real feature+table exists;
 * loans have no equivalent, so that half returns zero rather than 500ing.
 */
export async function getSubscriptionsLoansSummary(): Promise<{
  activeSubscriptions: number;
  totalSubscriptionValueMonthly: number;
  activeLoans: number;
  totalLoanRemaining: number;
}> {
  const db = createAdminClient();
  const { data: recurring } = await db
    .from("expenses")
    .select("amount, recurrence_interval")
    .eq("is_recurring", true)
    .eq("entry_type", "expense");

  const monthlyMultiplier: Record<string, number> = {
    monthly: 1,
    yearly: 1 / 12,
    weekly: 4.345,
    daily: 30.44,
  };

  const totalSubscriptionValueMonthly = (recurring ?? []).reduce((sum, r) => {
    const factor = monthlyMultiplier[r.recurrence_interval as string] ?? 1;
    return sum + Number(r.amount ?? 0) * factor;
  }, 0);

  return {
    activeSubscriptions: recurring?.length ?? 0,
    totalSubscriptionValueMonthly,
    activeLoans: 0,
    totalLoanRemaining: 0,
  };
}
