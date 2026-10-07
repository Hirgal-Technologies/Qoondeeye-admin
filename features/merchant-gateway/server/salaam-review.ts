import "server-only";
import {
  adminIdentityFromRecord,
  withSalaamAdminNames,
  type AdminIdentitySource,
} from "@/features/admin-users/identity";
import { createAdminClient } from "@/lib/supabase/admin";

export type SalaamReviewRow = {
  id: string;
  status: "needs_review" | "claimed" | "resolved";
  reason: "missing_faahfaahin" | "invalid_destination";
  amountCents: number;
  payerMsisdn: string;
  originalFaahfaahin: string | null;
  correctedDestination: string | null;
  bankTicket: string | null;
  providerReference: string | null;
  receivedAt: string;
  claimedBy: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  bundleId: string;
  providerName: string | null;
  bundleName: string | null;
  destinationType: string | null;
  orderId: string | null;
  eventId: string;
};

export async function listSalaamReviews(): Promise<SalaamReviewRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("salaam_offline_review_cases")
    .select("*, offline_bundle_payment_mappings(top_tayo_bundle_id, destination_type, offline_category)")
    .order("received_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const mapped = ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const mapping = row.offline_bundle_payment_mappings as Record<string, unknown> | null;
    return {
      id: String(row.id),
      status: row.status as SalaamReviewRow["status"],
      reason: row.reason as SalaamReviewRow["reason"],
      amountCents: Number(row.amount_cents),
      payerMsisdn: String(row.payer_msisdn),
      originalFaahfaahin: typeof row.original_faahfaahin === "string" ? row.original_faahfaahin : null,
      correctedDestination:
        typeof row.corrected_destination === "string" ? row.corrected_destination : null,
      bankTicket: typeof row.bank_ticket === "string" ? row.bank_ticket : null,
      providerReference: typeof row.provider_reference === "string" ? row.provider_reference : null,
      receivedAt: String(row.received_at),
      claimedBy: typeof row.claimed_by === "string" ? row.claimed_by : null,
      claimedByName: null,
      claimedAt: typeof row.claimed_at === "string" ? row.claimed_at : null,
      resolvedBy: typeof row.resolved_by === "string" ? row.resolved_by : null,
      resolvedByName: null,
      resolvedAt: typeof row.resolved_at === "string" ? row.resolved_at : null,
      bundleId: mapping ? String(mapping.top_tayo_bundle_id) : "",
      providerName: typeof row.provider_name === "string" ? row.provider_name : null,
      bundleName: typeof row.bundle_name === "string" ? row.bundle_name : null,
      destinationType: mapping ? String(mapping.destination_type) : null,
      orderId: typeof row.order_id === "string" ? row.order_id : null,
      eventId: String(row.merchant_payment_event_id),
    };
  });
  const identities = await loadSalaamAdminIdentities(
    db,
    mapped.flatMap((row) => [row.claimedBy, row.resolvedBy]),
  );
  return mapped.map((row) => withSalaamAdminNames(row, identities));
}

export async function forwardSalaamReview(
  accessToken: string,
  body: { action: "preview" | "claim" | "resolve"; reviewId: string; destination?: string },
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
