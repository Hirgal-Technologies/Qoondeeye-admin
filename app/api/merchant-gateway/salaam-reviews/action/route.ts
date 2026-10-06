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
  } | null;
  const action = body?.action;
  const reviewId = body?.reviewId?.trim() ?? "";
  if ((action !== "preview" && action !== "claim" && action !== "resolve") || !reviewId) {
    return apiFailure("invalid review action", 400);
  }
  const accessToken = await getAdminAccessToken();
  if (!accessToken) return apiFailure("unauthenticated", 401);
  const outcome = await forwardSalaamReview(accessToken, {
    action,
    reviewId,
    destination: body?.destination,
  });
  if (!outcome.ok) return apiFailure(outcome.message, outcome.status);
  return apiSuccess(outcome.payload);
}
