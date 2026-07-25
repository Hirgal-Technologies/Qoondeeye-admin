import type {
  SupportAccountAction,
  SupportAccountActionInput,
  SupportLookupInput,
} from "@/features/support/contracts";

type UnknownLookupBody = {
  identifier?: unknown;
  reason?: unknown;
  permissionConfirmed?: unknown;
};

export function parseSupportLookupInput(
  body: unknown
): SupportLookupInput | null {
  const candidate = body as UnknownLookupBody | null;
  const identifier =
    typeof candidate?.identifier === "string" ? candidate.identifier.trim() : "";
  const reason =
    typeof candidate?.reason === "string" ? candidate.reason.trim() : "";

  if (
    (!isUuid(identifier) && !isEmail(identifier)) ||
    reason.length < 20 ||
    candidate?.permissionConfirmed !== true
  ) {
    return null;
  }

  return { identifier, reason, permissionConfirmed: true };
}

const ACCOUNT_ACTIONS: SupportAccountAction[] = ["disable", "enable", "reset_password"];

type UnknownActionBody = {
  userId?: unknown;
  action?: unknown;
  reason?: unknown;
};

export function parseSupportAccountActionInput(
  body: unknown
): SupportAccountActionInput | null {
  const candidate = body as UnknownActionBody | null;
  const userId =
    typeof candidate?.userId === "string" ? candidate.userId.trim() : "";
  const reason =
    typeof candidate?.reason === "string" ? candidate.reason.trim() : "";
  const action =
    typeof candidate?.action === "string" &&
    ACCOUNT_ACTIONS.includes(candidate.action as SupportAccountAction)
      ? (candidate.action as SupportAccountAction)
      : null;

  if (!isUuid(userId) || !action || reason.length < 10) return null;

  return { userId, action, reason };
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
