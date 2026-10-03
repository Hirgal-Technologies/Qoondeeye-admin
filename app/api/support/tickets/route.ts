import type { NextRequest } from "next/server";
import {
  createSupportTicket,
  getSupportTickets,
} from "@/features/support-tickets/server/support-tickets-repository";
import {
  PRIORITIES,
  STATUSES,
  parseCreateSupportTicketInput,
} from "@/features/support-tickets/validation";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { parseOptionalEnum } from "@/lib/api/params";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { requireAdmin } from "@/lib/auth/require";

export const GET = createAdminGetHandler(
  { operation: "support.tickets.list", minimumRole: "support", cacheTtlMs: 0 },
  (request) =>
    getSupportTickets({
      status: parseOptionalEnum(request, "status", STATUSES),
      priority: parseOptionalEnum(request, "priority", PRIORITIES),
    })
);

export async function POST(request: NextRequest) {
  const { identity, response } = await requireAdmin("support");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const input = parseCreateSupportTicketInput(body);
  if (!input) {
    return apiFailure(
      "Enter a subject (3-200 chars), a description (10+ chars), and a valid requester email.",
      400
    );
  }

  try {
    const result = await createSupportTicket(identity, input);
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    console.error("[api:support.tickets.create]", error);
    return apiFailure("The ticket could not be created.", 500);
  }
}
