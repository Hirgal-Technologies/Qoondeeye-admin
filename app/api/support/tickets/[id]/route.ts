import type { NextRequest } from "next/server";
import {
  SupportTicketError,
  updateSupportTicket,
} from "@/features/support-tickets/server/support-tickets-repository";
import {
  isTicketId,
  parseUpdateSupportTicketInput,
} from "@/features/support-tickets/validation";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { requireAdmin } from "@/lib/auth/require";

type TicketRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: TicketRouteContext) {
  const { identity, response } = await requireAdmin("support");
  if (response) return response;

  const { id } = await context.params;
  if (!isTicketId(id)) return apiFailure("Invalid ticket ID.", 400);

  const body = await request.json().catch(() => null);
  const input = parseUpdateSupportTicketInput(body);
  if (!input) {
    return apiFailure("Enter a valid status, priority, and/or assignee.", 400);
  }

  try {
    await updateSupportTicket(identity, Number(id), input);
    return apiSuccess({ id: Number(id) });
  } catch (error) {
    if (error instanceof SupportTicketError) {
      if (error.code === "not_found") return apiFailure("Ticket not found.", 404);
      if (error.code === "invalid_assignee") {
        return apiFailure("The selected assignee is not a dashboard user.", 400);
      }
    }
    console.error("[api:support.tickets.update]", error);
    return apiFailure("The ticket could not be updated.", 500);
  }
}
