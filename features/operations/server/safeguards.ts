import "server-only";
import type { ProductionSafeguardView } from "@/features/operations/contracts";
import {
  presentProductionStatus,
  unavailableProductionStatus,
  type ProductionStatusPayload,
} from "@/features/operations/present-status";
import { callQoondeeyeAdmin } from "@/features/qoondeeye/admin-functions";
import { getAdminAccessToken } from "@/lib/auth/session";

/**
 * Reads Qoondeeye's admin production-status function with the signed-in admin JWT.
 * A failed call stays unavailable. It is never filled with zero or "enabled".
 */
export async function getProductionSafeguardView(): Promise<ProductionSafeguardView> {
  const accessToken = await getAdminAccessToken();
  if (!accessToken) return unavailableProductionStatus();

  const call = await callQoondeeyeAdmin(accessToken, "productionStatus");
  if (call.networkError || call.status !== 200 || !isRecord(call.body)) {
    return unavailableProductionStatus();
  }
  return presentProductionStatus(call.body as ProductionStatusPayload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
