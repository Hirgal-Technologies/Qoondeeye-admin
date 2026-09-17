import type { RechargeInput } from "@/features/reseller/contracts";

type UnknownRechargeBody = {
  sender?: unknown;
  receiver?: unknown;
  bundleId?: unknown;
};

export function parseRechargeInput(body: unknown): RechargeInput | null {
  const candidate = body as UnknownRechargeBody | null;

  const sender = toPhoneNumber(candidate?.sender);
  const receiver = toPhoneNumber(candidate?.receiver);
  const bundleId =
    typeof candidate?.bundleId === "string" ? candidate.bundleId.trim() : "";

  if (sender === null || receiver === null || !bundleId) {
    return null;
  }

  return { sender, receiver, bundleId };
}

function toPhoneNumber(value: unknown): number | null {
  const number = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) {
    return null;
  }
  return number;
}
