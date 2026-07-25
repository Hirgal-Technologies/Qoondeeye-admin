import "server-only";
import type {
  AssignableAdmin,
  CreateSupportTicketInput,
  SupportTicketRow,
  UpdateSupportTicketInput,
} from "@/features/support-tickets/contracts";
import type { AdminIdentity } from "@/features/auth/contracts";
import { writeAuditLog } from "@/features/audit/server/audit-repository";
import { createAdminClient } from "@/lib/supabase/admin";

export type SupportTicketErrorCode = "not_found" | "invalid_assignee";

export class SupportTicketError extends Error {
  constructor(public readonly code: SupportTicketErrorCode) {
    super(code);
    this.name = "SupportTicketError";
  }
}

const TICKET_SELECT =
  "id, subject, description, status, priority, requester_email, requester_user_id, assignee_id, created_at, updated_at, resolved_at, assignee:admin_users!support_tickets_assignee_id_fkey(email)";

type TicketRow = {
  id: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  requester_email: string;
  requester_user_id: string | null;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  assignee: { email: string } | { email: string }[] | null;
};

function mapTicket(row: TicketRow): SupportTicketRow {
  const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee;
  return {
    id: row.id,
    subject: row.subject,
    description: row.description,
    status: row.status as SupportTicketRow["status"],
    priority: row.priority as SupportTicketRow["priority"],
    requesterEmail: row.requester_email,
    requesterUserId: row.requester_user_id,
    assigneeId: row.assignee_id,
    assigneeEmail: assignee?.email ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

export async function getSupportTickets(filters?: {
  status?: string;
  priority?: string;
}): Promise<SupportTicketRow[]> {
  const db = createAdminClient();
  let query = db
    .from("support_tickets")
    .select(TICKET_SELECT)
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.priority) query = query.eq("priority", filters.priority);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => mapTicket(row as unknown as TicketRow));
}

export async function getAssignableAdmins(): Promise<AssignableAdmin[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_users")
    .select("id, email, role")
    .in("role", ["admin", "support"])
    .order("email", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    email: String(row.email),
    role: String(row.role),
  }));
}

export async function createSupportTicket(
  actor: AdminIdentity,
  input: CreateSupportTicketInput
): Promise<{ id: number }> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("support_tickets")
    .insert({
      subject: input.subject,
      description: input.description,
      priority: input.priority,
      requester_email: input.requesterEmail,
      requester_user_id: input.requesterUserId ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "support_ticket_created",
    metadata: {
      resource: "Support tickets",
      outcome: "Completed",
      ticketId: data.id,
      subject: input.subject,
      priority: input.priority,
      requesterEmail: input.requesterEmail,
    },
  });

  return { id: Number(data.id) };
}

export async function updateSupportTicket(
  actor: AdminIdentity,
  ticketId: number,
  input: UpdateSupportTicketInput
): Promise<void> {
  const db = createAdminClient();

  const { data: current, error: findError } = await db
    .from("support_tickets")
    .select("id, status, priority, assignee_id")
    .eq("id", ticketId)
    .maybeSingle();

  if (findError) throw findError;
  if (!current) throw new SupportTicketError("not_found");

  if (input.assigneeId) {
    const { data: assignee, error: assigneeError } = await db
      .from("admin_users")
      .select("id")
      .eq("id", input.assigneeId)
      .maybeSingle();
    if (assigneeError) throw assigneeError;
    if (!assignee) throw new SupportTicketError("invalid_assignee");
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.status !== undefined) {
    patch.status = input.status;
    patch.resolved_at =
      input.status === "resolved" || input.status === "closed"
        ? new Date().toISOString()
        : null;
  }
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.assigneeId !== undefined) patch.assignee_id = input.assigneeId;

  const { error: updateError } = await db
    .from("support_tickets")
    .update(patch)
    .eq("id", ticketId);

  if (updateError) throw updateError;

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "support_ticket_updated",
    metadata: {
      resource: "Support tickets",
      outcome: "Completed",
      ticketId,
      previousStatus: current.status,
      previousPriority: current.priority,
      previousAssigneeId: current.assignee_id,
      ...input,
    },
  });
}
