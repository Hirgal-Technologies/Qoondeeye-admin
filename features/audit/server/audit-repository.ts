import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditLogRow } from "@/features/audit/contracts";

export async function writeAuditLog(entry: {
  actorId: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
}) {
  const db = createAdminClient();
  const actorEmail = entry.actorEmail ?? "Unknown admin";
  const actorRole = entry.actorRole ?? "unknown";
  const { error } = await db.from("audit_log").insert({
    actor_id: entry.actorId,
    actor_email: actorEmail,
    actor_role: actorRole,
    action: entry.action,
    target_user_id: entry.targetUserId ?? null,
    metadata: {
      actorEmail,
      actorRole,
      ...(entry.metadata ?? {}),
    },
  });
  if (error) throw error;
}

export async function getAuditLogs(limit = 100): Promise<AuditLogRow[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("audit_log")
    .select(
      "id, actor_email, actor_role, action, target_user_id, metadata, created_at, actor:admin_users!audit_log_actor_id_fkey(email, role)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return mapAuditRows(data);
}

export async function getSupportAuditEvents(limit = 15): Promise<AuditLogRow[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("audit_log")
    .select(
      "id, actor_email, actor_role, action, target_user_id, metadata, created_at, actor:admin_users!audit_log_actor_id_fkey(email, role)"
    )
    .like("action", "support_%")
    .order("created_at", { ascending: false })
    .limit(limit);

  return mapAuditRows(data);
}

function mapAuditRows(
  data: Array<{
    id: number | string;
    actor_email: string | null;
    actor_role: string | null;
    action: string;
    target_user_id: string | null;
    metadata: unknown;
    created_at: string;
    actor: { email: string; role: string } | { email: string; role: string }[] | null;
  }> | null
): AuditLogRow[] {
  return (data ?? []).map((row) => {
    const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    return {
      id: Number(row.id),
      actorEmail: String(
        actor?.email ?? row.actor_email ?? metadata.actorEmail ?? "Unknown admin"
      ),
      actorRole: String(
        actor?.role ?? row.actor_role ?? metadata.actorRole ?? "unknown"
      ),
      action: String(row.action),
      resource: row.target_user_id
        ? `User ${String(row.target_user_id).slice(0, 8)}…`
        : String(metadata.source ?? metadata.resource ?? "Dashboard"),
      createdAt: String(row.created_at),
      outcome: String(metadata.outcome ?? "Completed"),
    };
  });
}
