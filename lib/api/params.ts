import type { NextRequest } from "next/server";
import type {
  Granularity,
  TxType,
} from "@/features/analytics/shared/contracts";
import { ApiError } from "@/lib/api/responses";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseTimestamp(value: string, key: string) {
  // Accept dates (YYYY-MM-DD) and full ISO timestamps; reject anything else
  // instead of forwarding it to Postgres and surfacing a 500.
  if (!/^\d{4}-\d{2}-\d{2}([T ][0-9:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(value)) {
    throw new ApiError(400, `${key} must be an ISO 8601 date`);
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new ApiError(400, `${key} must be an ISO 8601 date`);
  return ms;
}

export function parseDateRange(request: NextRequest, defaultDays = 30) {
  const searchParams = request.nextUrl.searchParams;
  const rawTo = searchParams.get("to");
  const rawFrom = searchParams.get("from");
  const to = rawTo ?? new Date().toISOString();
  const from =
    rawFrom ?? new Date(Date.now() - defaultDays * 86_400_000).toISOString();

  if (parseTimestamp(from, "from") > parseTimestamp(to, "to")) {
    throw new ApiError(400, "from must be before to");
  }
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

/** Optional UUID query param; a malformed value is a 400, not a DB error. */
export function parseOptionalUuid(request: NextRequest, key: string) {
  const value = request.nextUrl.searchParams.get(key)?.trim();
  if (!value) return undefined;
  if (!UUID_PATTERN.test(value)) throw new ApiError(400, `${key} must be a UUID`);
  return value;
}

/** Optional enum query param; an unknown value is a 400 rather than an empty list. */
export function parseOptionalEnum<T extends string>(
  request: NextRequest,
  key: string,
  allowed: readonly T[]
): T | undefined {
  const value = request.nextUrl.searchParams.get(key)?.trim();
  if (!value) return undefined;
  if (!allowed.includes(value as T)) {
    throw new ApiError(400, `${key} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}
