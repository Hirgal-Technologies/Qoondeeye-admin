import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function writeAuditLog(entry: {
  actorId: string;
  action: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
}) {
  const db = createAdminClient();
  await db.from("audit_log").insert({
    actor_id: entry.actorId,
    action: entry.action,
    target_user_id: entry.targetUserId ?? null,
    metadata: entry.metadata ?? {},
  });
}

export type AuditLogRow = {
  id: number;
  actorEmail: string;
  actorRole: string;
  action: string;
  resource: string;
  createdAt: string;
  outcome: string;
};

export async function getAuditLogs(limit = 100): Promise<AuditLogRow[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("audit_log")
    .select(
      "id, action, target_user_id, metadata, created_at, actor:admin_users!audit_log_actor_id_fkey(email, role)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    return {
      id: Number(row.id),
      actorEmail: String(actor?.email ?? "Unknown admin"),
      actorRole: String(actor?.role ?? "unknown"),
      action: String(row.action),
      resource: row.target_user_id
        ? `User ${String(row.target_user_id).slice(0, 8)}…`
        : String(metadata.source ?? metadata.resource ?? "Dashboard"),
      createdAt: String(row.created_at),
      outcome: String(metadata.outcome ?? "Completed"),
    };
  });
}
