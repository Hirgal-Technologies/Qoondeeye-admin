import "server-only";
import type { NextRequest } from "next/server";
import { parseDateRange, parseGranularity } from "@/lib/api/params";
import { getRetentionCurve } from "@/lib/data/overview";
import {
  getAuthMethodBreakdown,
  getChurn,
  getCohortRetention,
  getSignupTrend,
} from "@/lib/data/users";
import {
  getAccountTypeDistribution,
  getBudgetAdherence,
  getCategoryDistribution,
  getSubscriptionsLoansSummary,
  getTransactionVolume,
} from "@/lib/data/finance";
import { getOcrSuccessRate, getRecentErrors, getSyncHealth } from "@/lib/data/system";
import type { TxType } from "@/lib/data/types";

export type ExportSource = keyof typeof exportRegistry;

/** Per-source: is this endpoint per-user (support tools)? Drives audit logging. */
export const PER_USER_SOURCES = new Set<string>([]); // support endpoints not wired into export yet (Phase 4 deferred)

function asRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") return [data as Record<string, unknown>];
  return [];
}

export const exportRegistry = {
  "overview/retention": async (request: NextRequest) => {
    const cohortWindow = Number(request.nextUrl.searchParams.get("cohortWindow") ?? "30");
    return asRows(await getRetentionCurve(cohortWindow));
  },
  "users/signups": async (request: NextRequest) => {
    const { from, to } = parseDateRange(request);
    const granularity = parseGranularity(request);
    return asRows(await getSignupTrend({ from, to, granularity }));
  },
  "users/auth-methods": async () => asRows(await getAuthMethodBreakdown()),
  "users/cohort-retention": async (request: NextRequest) => {
    const { from, to } = parseDateRange(request, 60);
    return asRows(await getCohortRetention({ from, to }));
  },
  "users/churn": async (request: NextRequest) => {
    const inactiveDays = Number(request.nextUrl.searchParams.get("inactiveDays") ?? "30");
    return asRows(await getChurn(inactiveDays));
  },
  "finance/transaction-volume": async (request: NextRequest) => {
    const { from, to } = parseDateRange(request);
    const granularity = parseGranularity(request);
    const typeParam = request.nextUrl.searchParams.get("type");
    const type =
      typeParam === "expense" || typeParam === "income" || typeParam === "transfer"
        ? (typeParam as TxType)
        : undefined;
    return asRows(await getTransactionVolume({ from, to, granularity, type }));
  },
  "finance/category-distribution": async (request: NextRequest) => {
    const { from, to } = parseDateRange(request);
    return asRows(await getCategoryDistribution({ from, to }));
  },
  "finance/budget-adherence": async (request: NextRequest) => {
    const { from, to } = parseDateRange(request);
    return asRows(await getBudgetAdherence({ from, to }));
  },
  "finance/account-types": async () => asRows(await getAccountTypeDistribution()),
  "finance/subscriptions-loans-summary": async () =>
    asRows(await getSubscriptionsLoansSummary()),
  "system/sync-health": async (request: NextRequest) => {
    const { from, to } = parseDateRange(request);
    return asRows(await getSyncHealth({ from, to }));
  },
  "system/ocr-success-rate": async (request: NextRequest) => {
    const { from, to } = parseDateRange(request);
    return asRows(await getOcrSuccessRate({ from, to }));
  },
  "system/errors": async (request: NextRequest) => {
    const { from, to } = parseDateRange(request);
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "100");
    return asRows(await getRecentErrors({ from, to, limit }));
  },
} as const;
