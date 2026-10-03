import type { NextRequest } from "next/server";
import { runRecharge } from "@/features/reseller/server/recharge";
import { invalidateCachedResponses } from "@/lib/api/query-cache";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { requireAdmin } from "@/lib/auth/require";

export async function POST(request: NextRequest) {
  const { identity, response } = await requireAdmin("admin");
  if (response) return response;

  const body = await request.json().catch(() => null);

  try {
    const result = await runRecharge(identity, body);
    if (!result.ok) {
      if (result.reason === "invalid_request") {
        return apiFailure("invalid recharge request", 400);
      }
      // Pass through request-level rejections; any other upstream status
      // (e.g. TopTayo rejecting our API key with 401) is a gateway failure,
      // not the admin's session expiring.
      const status = [400, 404, 409, 422].includes(result.status) ? result.status : 502;
      return apiFailure(result.message, status);
    }
    // The recharge spent from the TopTayo balance served by /business.
    invalidateCachedResponses("resellers.business.get");
    return apiSuccess(
      { message: result.message, transactionIds: result.transactionIds },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api:resellers.recharge]", error);
    return apiFailure("The recharge could not be completed.", 500);
  }
}
