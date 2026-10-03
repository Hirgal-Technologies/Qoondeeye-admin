import type { ProductionSafeguardView } from "@/features/operations/contracts";
import { PRODUCTION_MONEY_TTL_MS, shouldFetchProductionMoney } from "@/lib/hooks/live-refresh";

export { PRODUCTION_MONEY_TTL_MS, shouldFetchProductionMoney };

/**
 * A failed production-status call keeps the last known snapshot.
 * Unknown fields stay unavailable. They are never replaced with zero.
 */
export function mergeSafeguardRefresh(
  previous: ProductionSafeguardView | null,
  next: ProductionSafeguardView,
  ok: boolean,
): ProductionSafeguardView {
  if (!ok && previous) return { ...previous, stale: true };
  return { ...next, stale: false };
}
