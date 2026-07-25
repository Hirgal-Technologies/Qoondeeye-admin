export type SupportLookupInput = {
  identifier: string;
  reason: string;
  permissionConfirmed: boolean;
};

export type SupportUser = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  providers: string[];
  bannedUntil: string | null;
  isBanned: boolean;
};

export type SupportLookupResult =
  | { ok: true; user: SupportUser }
  | { ok: false; reason: "invalid_request" | "not_found" };

export type SupportAccountAction = "disable" | "enable" | "reset_password";

export type SupportAccountActionInput = {
  userId: string;
  action: SupportAccountAction;
  reason: string;
};

export type SupportAccountActionResult =
  | { ok: true; user: SupportUser }
  | { ok: false; reason: "invalid_request" | "not_found" };
