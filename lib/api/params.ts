import type { NextRequest } from "next/server";
import type {
  Granularity,
  TxType,
} from "@/features/analytics/shared/contracts";

export function parseDateRange(request: NextRequest, defaultDays = 30) {
  const searchParams = request.nextUrl.searchParams;
  const to = searchParams.get("to") ?? new Date().toISOString();
  const from =
    searchParams.get("from") ??
    new Date(Date.now() - defaultDays * 86_400_000).toISOString();
  return { from, to };
}

export function parseGranularity(request: NextRequest): Granularity {
  const g = request.nextUrl.searchParams.get("granularity");
  return g === "week" || g === "month" ? g : "day";
}

export function parseBoundedInteger(
  request: NextRequest,
  key: string,
  fallback: number,
  bounds: { min: number; max: number }
) {
  const value = Number(request.nextUrl.searchParams.get(key) ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), bounds.min), bounds.max);
}

export function parseTransactionType(request: NextRequest): TxType | undefined {
  const value = request.nextUrl.searchParams.get("type");
  return value === "expense" || value === "income" || value === "transfer"
    ? value
    : undefined;
}
