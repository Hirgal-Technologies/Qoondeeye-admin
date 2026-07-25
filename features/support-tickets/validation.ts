import type {
  CreateSupportTicketInput,
  SupportTicketPriority,
  SupportTicketStatus,
  UpdateSupportTicketInput,
} from "@/features/support-tickets/contracts";

const STATUSES: SupportTicketStatus[] = ["open", "pending", "resolved", "closed"];
const PRIORITIES: SupportTicketPriority[] = ["low", "normal", "high", "urgent"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UnknownCreateBody = {
  subject?: unknown;
  description?: unknown;
  priority?: unknown;
  requesterEmail?: unknown;
};

export function parseCreateSupportTicketInput(
  body: unknown
): CreateSupportTicketInput | null {
  const candidate = body as UnknownCreateBody | null;
  const subject =
    typeof candidate?.subject === "string" ? candidate.subject.trim() : "";
  const description =
    typeof candidate?.description === "string"
      ? candidate.description.trim()
      : "";
  const requesterEmail =
    typeof candidate?.requesterEmail === "string"
      ? candidate.requesterEmail.trim().toLowerCase()
      : "";
  const priority =
    typeof candidate?.priority === "string" &&
    PRIORITIES.includes(candidate.priority as SupportTicketPriority)
      ? (candidate.priority as SupportTicketPriority)
      : "normal";

  if (
    subject.length < 3 ||
    subject.length > 200 ||
    description.length < 10 ||
    !EMAIL_PATTERN.test(requesterEmail)
  ) {
    return null;
  }

  return { subject, description, priority, requesterEmail };
}

type UnknownUpdateBody = {
  status?: unknown;
  priority?: unknown;
  assigneeId?: unknown;
};

export function parseUpdateSupportTicketInput(
  body: unknown
): UpdateSupportTicketInput | null {
  const candidate = body as UnknownUpdateBody | null;
  if (!candidate || typeof candidate !== "object") return null;

  const input: UpdateSupportTicketInput = {};

  if (candidate.status !== undefined) {
    if (
      typeof candidate.status !== "string" ||
      !STATUSES.includes(candidate.status as SupportTicketStatus)
    ) {
      return null;
    }
    input.status = candidate.status as SupportTicketStatus;
  }

  if (candidate.priority !== undefined) {
    if (
      typeof candidate.priority !== "string" ||
      !PRIORITIES.includes(candidate.priority as SupportTicketPriority)
    ) {
      return null;
    }
    input.priority = candidate.priority as SupportTicketPriority;
  }

  if (candidate.assigneeId !== undefined) {
    if (
      candidate.assigneeId !== null &&
      (typeof candidate.assigneeId !== "string" ||
        !UUID_PATTERN.test(candidate.assigneeId))
    ) {
      return null;
    }
    input.assigneeId = candidate.assigneeId;
  }

  if (Object.keys(input).length === 0) return null;

  return input;
}

export function isTicketId(value: string) {
  return /^\d+$/.test(value);
}
