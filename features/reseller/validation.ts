import type { RechargeInput } from "@/features/reseller/contracts";

type UnknownRechargeBody = {
  sender?: unknown;
  receiver?: unknown;
  bundleId?: unknown;
  scheduledTime?: unknown;
  reason?: unknown;
};

export function parseRechargeInput(body: unknown): RechargeInput | null {
  const candidate = body as UnknownRechargeBody | null;

  const sender = toPhoneNumber(candidate?.sender);
  const receiver = toPhoneNumber(candidate?.receiver);
  const bundleId =
    typeof candidate?.bundleId === "string" ? candidate.bundleId.trim() : "";
  const reason =
    typeof candidate?.reason === "string" ? candidate.reason.trim() : "";

  if (sender === null || receiver === null || !bundleId || reason.length < 10) {
    return null;
  }

  let scheduledTime: string | undefined;
  if (candidate?.scheduledTime !== undefined && candidate.scheduledTime !== "") {
    if (typeof candidate.scheduledTime !== "string") return null;
    const parsed = new Date(candidate.scheduledTime);
    if (Number.isNaN(parsed.getTime())) return null;
    scheduledTime = parsed.toISOString();
  }

  return { sender, receiver, bundleId, reason, scheduledTime };
}

function toPhoneNumber(value: unknown): number | null {
  const number = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) {
    return null;
  }
  return number;
}
