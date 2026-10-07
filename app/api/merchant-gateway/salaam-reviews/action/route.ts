import type { NextRequest } from "next/server";
import { forwardSalaamReview } from "@/features/merchant-gateway/server/salaam-review";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { requireAdmin } from "@/lib/auth/require";
import { getAdminAccessToken } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin("admin");
  if (response) return response;
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    reviewId?: string;
    destination?: string;
    mappingId?: string;
    resolutionNote?: string;
    confirmed?: boolean;
  } | null;
  const action = body?.action;
  const reviewId = body?.reviewId?.trim() ?? "";
  const allowed =
    action === "preview" ||
    action === "claim" ||
    action === "resolve" ||
    action === "payable_bundles" ||
    action === "select_intended_bundle" ||
    action === "resolve_without_fulfillment";
  if (!allowed || !reviewId) {
    return apiFailure("invalid review action", 400);
  }
  const accessToken = await getAdminAccessToken();
  if (!accessToken) return apiFailure("unauthenticated", 401);
  const outcome = await forwardSalaamReview(accessToken, {
    action,
    reviewId,
    destination: body?.destination,
    mappingId: body?.mappingId,
    resolutionNote: body?.resolutionNote,
    confirmed: body?.confirmed === true,
  });
  if (!outcome.ok) return apiFailure(outcome.message, outcome.status);
  return apiSuccess(outcome.payload);
}
