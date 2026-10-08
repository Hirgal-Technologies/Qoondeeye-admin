/**
 * Request shape for the pre-production cleanup edge function.
 * This module does not call TopTayo.
 */

const DEVICE_ID = /^[a-zA-Z0-9._-]{2,64}$/;

export type PreproductionCleanupRequest = {
  cutoffAt: string;
  protectedDeviceId: string;
  reason: string;
  apply: boolean;
};

export type PreproductionCleanupPreview = {
  dryRun: boolean;
  cutoffAt: string;
  protectedDeviceId: string;
  counts: {
    ordersToArchive: number;
    paymentsToArchive: number;
    gatewayAlertsToArchive: number;
    fulfillmentAlertsToArchive: number;
    devicesToRevoke: number;
    blockedOrders: number;
  };
  revokeDevices: Array<{ id: string; name: string; status: string }>;
  blockedOrderIds: string[];
  truncated: boolean;
  notes: string[];
  preservesFinancialStatus: true;
  applied?: {
    ordersArchived: number;
    paymentsArchived: number;
    gatewayAlertsArchived: number;
    fulfillmentAlertsArchived: number;
    devicesRevoked: number;
  };
};

export function parsePreproductionCleanupRequest(
  body: unknown,
  nowMs = Date.now(),
): { ok: true; value: PreproductionCleanupRequest } | { ok: false; message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "The cleanup request was incomplete." };
  }
  const record = body as Record<string, unknown>;
  const cutoffRaw = typeof record.cutoffAt === "string" ? record.cutoffAt.trim() : "";
  const cutoffMs = Date.parse(cutoffRaw);
  if (!Number.isFinite(cutoffMs)) {
    return { ok: false, message: "Choose the time when production testing started." };
  }
  if (cutoffMs > nowMs - 60_000) {
    return { ok: false, message: "The cutoff must be at least one minute in the past." };
  }
  const protectedDeviceId =
    typeof record.protectedDeviceId === "string" ? record.protectedDeviceId.trim() : "";
  if (!DEVICE_ID.test(protectedDeviceId)) {
    return { ok: false, message: "Choose the current production gateway. It will not be revoked." };
  }
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";
  if (reason.length < 12 || reason.length > 500) {
    return { ok: false, message: "Write a reason of at least 12 characters. It is stored with the audit." };
  }
  return {
    ok: true,
    value: {
      cutoffAt: new Date(cutoffMs).toISOString(),
      protectedDeviceId,
      reason,
      apply: record.apply === true,
    },
  };
}

export function cleanupPreviewKey(value: Pick<PreproductionCleanupRequest, "cutoffAt" | "protectedDeviceId" | "reason">) {
  return `${value.cutoffAt}|${value.protectedDeviceId}|${value.reason}`;
}
