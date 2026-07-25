import type { SupportLookupInput } from "@/features/support/contracts";

type UnknownLookupBody = {
  userId?: unknown;
  reason?: unknown;
  permissionConfirmed?: unknown;
};

export function parseSupportLookupInput(
  body: unknown
): SupportLookupInput | null {
  const candidate = body as UnknownLookupBody | null;
  const userId =
    typeof candidate?.userId === "string" ? candidate.userId.trim() : "";
  const reason =
    typeof candidate?.reason === "string" ? candidate.reason.trim() : "";

  if (
    !isUuid(userId) ||
    reason.length < 20 ||
    candidate?.permissionConfirmed !== true
  ) {
    return null;
  }

  return { userId, reason, permissionConfirmed: true };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
