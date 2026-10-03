import "server-only";
import type { ProductionSafeguardView } from "@/features/operations/contracts";
import {
  mergeSafeguardRefresh,
  PRODUCTION_MONEY_TTL_MS,
  shouldFetchProductionMoney,
} from "@/features/operations/money-refresh";
import {
  presentProductionStatus,
  unavailableProductionStatus,
  type ProductionStatusPayload,
} from "@/features/operations/present-status";
import { callQoondeeyeAdmin } from "@/features/qoondeeye/admin-functions";
import { getAdminAccessToken } from "@/lib/auth/session";

type MoneyCache = { at: number; view: ProductionSafeguardView };

let moneyCache: MoneyCache | null = null;
let moneyInFlight: Promise<ProductionSafeguardView> | null = null;

/**
 * Reads Qoondeeye's admin production-status function with the signed-in admin JWT.
 * Successful snapshots are reused for 20 seconds so the operations page can poll
 * orders without calling TopTayo every few seconds. A failed call keeps the last
 * known snapshot and is never filled with zero or "enabled".
 */
export async function getProductionSafeguardView(options?: {
  force?: boolean;
}): Promise<ProductionSafeguardView> {
  const force = options?.force === true;
  const now = Date.now();
  if (
    !shouldFetchProductionMoney({
      now,
      cachedAt: moneyCache?.at ?? null,
      ttlMs: PRODUCTION_MONEY_TTL_MS,
      force,
    }) &&
    moneyCache
  ) {
    return { ...moneyCache.view, stale: moneyCache.view.stale === true };
  }
  if (moneyInFlight) return moneyInFlight;

  moneyInFlight = loadProductionMoney()
    .then((loaded) => {
      const merged = mergeSafeguardRefresh(moneyCache?.view ?? null, loaded.view, loaded.ok);
      if (loaded.ok) moneyCache = { at: Date.now(), view: merged };
      else if (moneyCache) moneyCache = { ...moneyCache, view: merged };
      return merged;
    })
    .finally(() => {
      moneyInFlight = null;
    });
  return moneyInFlight;
}

async function loadProductionMoney(): Promise<{ ok: boolean; view: ProductionSafeguardView }> {
  const accessToken = await getAdminAccessToken();
  if (!accessToken) return { ok: false, view: unavailableProductionStatus() };

  const call = await callQoondeeyeAdmin(accessToken, "productionStatus");
  if (call.networkError || call.status !== 200 || !isRecord(call.body)) {
    return { ok: false, view: unavailableProductionStatus() };
  }
  return { ok: true, view: presentProductionStatus(call.body as ProductionStatusPayload) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
