import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { AdminIdentity, AdminRole } from "@/features/auth/contracts";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { readCachedResponse, writeCachedResponse } from "@/lib/api/query-cache";
import { requireAdmin } from "@/lib/auth/require";

type AdminQuery<T> = (
  request: NextRequest,
  identity: AdminIdentity
) => T | Promise<T>;

type AdminRouteOptions = {
  minimumRole?: AdminRole;
  operation: string;
  /**
   * How long a computed response may be served from the in-process cache.
   * Defaults to 30s — appropriate for aggregate analytics that are identical
   * for every authorized viewer. Pass 0 for endpoints whose output must
   * reflect mutations immediately (rosters, audit trails).
   */
  cacheTtlMs?: number;
};

const DEFAULT_CACHE_TTL_MS = 30_000;

function jsonResponse(body: string, cacheStatus: "HIT" | "MISS") {
  return new NextResponse(body, {
    headers: {
      "content-type": "application/json",
      "cache-control": "private, no-store",
      "x-query-cache": cacheStatus,
    },
  });
}

/**
 * Composes the cross-cutting concerns shared by read-only admin endpoints:
 * authorization, the API envelope, response caching, and safe error handling.
 * Authorization always runs per request — only the query result is cached.
 */
export function createAdminGetHandler<T>(
  options: AdminRouteOptions,
  query: AdminQuery<T>
) {
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  return async function GET(request: NextRequest) {
    const { identity, response } = await requireAdmin(
      options.minimumRole ?? "viewer"
    );
    if (response) return response;

    const cacheKey = `${options.operation}${new URL(request.url).search}`;
    if (cacheTtlMs > 0) {
      const cached = readCachedResponse(cacheKey);
      if (cached !== null) return jsonResponse(cached, "HIT");
    }

    try {
      const data = await query(request, identity);
      if (cacheTtlMs > 0) {
        const body = JSON.stringify({ data, error: null });
        writeCachedResponse(cacheKey, body, cacheTtlMs);
        return jsonResponse(body, "MISS");
      }
      return apiSuccess(data);
    } catch (error) {
      console.error(`[api:${options.operation}]`, error);
      return apiFailure("internal server error", 500);
    }
  };
}
