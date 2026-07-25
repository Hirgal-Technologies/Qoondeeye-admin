export type SupportLookupInput = {
  userId: string;
  reason: string;
  permissionConfirmed: boolean;
};

export type SupportUser = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  providers: string[];
};

export type SupportLookupResult =
  | { ok: true; user: SupportUser }
  | { ok: false; reason: "invalid_request" | "not_found" };
