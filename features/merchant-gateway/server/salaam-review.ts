import "server-only";
import {
  adminIdentityFromRecord,
  withSalaamAdminNames,
  type AdminIdentitySource,
} from "@/features/admin-users/identity";
import {
  mapSalaamReviewRecord,
  SALAAM_REVIEW_LIST_SELECT,
  type SalaamReviewRecord,
} from "@/features/merchant-gateway/salaam-review-query";
import { createAdminClient } from "@/lib/supabase/admin";

export type SalaamReviewRow = SalaamReviewRecord;

export async function listSalaamReviews(): Promise<SalaamReviewRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("salaam_offline_review_cases")
    .select(SALAAM_REVIEW_LIST_SELECT)
    .order("received_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const mapped = ((data ?? []) as unknown as Record<string, unknown>[]).map((row) =>
    mapSalaamReviewRecord(row),
  );
  const identities = await loadSalaamAdminIdentities(
    db,
    mapped.flatMap((row) => [row.claimedBy, row.resolvedBy]),
  );
  return mapped.map((row) => withSalaamAdminNames(row, identities));
}

export async function forwardSalaamReview(
  accessToken: string,
  body: {
    action:
      | "preview"
      | "claim"
      | "resolve"
      | "payable_bundles"
      | "select_intended_bundle"
      | "resolve_without_fulfillment";
    reviewId: string;
    destination?: string;
    mappingId?: string;
    resolutionNote?: string;
    confirmed?: boolean;
  },
): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false; status: number; message: string }> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_KEY;
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, message: "Supabase is not configured." };
  }
  const response = await fetch(`${supabaseUrl}/functions/v1/bundles-salaam-offline-review`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || payload?.ok !== true) {
    return {
      ok: false,
      status: response.status,
      message: typeof payload?.message === "string" ? payload.message : "The review action was rejected.",
    };
  }
  return { ok: true, payload };
}

async function loadSalaamAdminIdentities(
  db: ReturnType<typeof createAdminClient>,
  adminIds: Array<string | null>,
): Promise<Map<string, AdminIdentitySource>> {
  const ids = [...new Set(adminIds.filter((id): id is string => Boolean(id)))];
  const identities = new Map<string, AdminIdentitySource>();
  for (const id of ids) identities.set(id, { id });
  if (ids.length === 0) return identities;

  try {
    const [profiles, admins] = await Promise.all([
      db.from("profiles").select("id, full_name").in("id", ids),
      db.from("admin_users").select("id, email").in("id", ids),
    ]);
    if (!profiles.error) {
      for (const row of (profiles.data ?? []) as Array<{ id: string; full_name: string | null }>) {
        const current = identities.get(String(row.id));
        if (!current) continue;
        identities.set(
          current.id,
          adminIdentityFromRecord({
            id: current.id,
            profileFullName: row.full_name,
            email: current.email,
          }),
        );
      }
    }
    if (!admins.error) {
      for (const row of (admins.data ?? []) as Array<{ id: string; email: string | null }>) {
        const current = identities.get(String(row.id)) ?? { id: String(row.id) };
        identities.set(
          current.id,
          adminIdentityFromRecord({
            id: current.id,
            profileFullName: current.fullName,
            email: row.email,
            metadata: current.username ? { username: current.username } : null,
          }),
        );
      }
    }
    await Promise.all(
      ids.map(async (id) => {
        const current = identities.get(id);
        if (current?.fullName?.trim()) return;
        try {
          const authResult = await db.auth.admin.getUserById(id);
          if (authResult.error || !authResult.data.user) return;
          const user = authResult.data.user;
          identities.set(
            id,
            adminIdentityFromRecord({
              id,
              profileFullName: current?.fullName,
              email: current?.email ?? user.email,
              metadata: (user.user_metadata ?? {}) as Record<string, unknown>,
            }),
          );
        } catch {
          // A missing auth user still leaves the roster email or the raw id.
        }
      }),
    );
  } catch {
    return identities;
  }
  return identities;
}
