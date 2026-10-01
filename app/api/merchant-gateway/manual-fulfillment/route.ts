import type { NextRequest } from "next/server";
import { runManualFulfillment } from "@/features/merchant-gateway/server/manual-fulfillment";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { requireAdmin } from "@/lib/auth/require";

export async function POST(request: NextRequest) {
  const { identity, response } = await requireAdmin("admin");
  if (response) return response;

  const body = await request.json().catch(() => null);
  try {
    const result = await runManualFulfillment(identity, body);
    if (!result.ok) return apiFailure(result.message, result.status);
    return apiSuccess({
      state: result.state,
      message: result.message,
      transactionId: result.transactionId,
    });
  } catch (error) {
    console.error("[api:merchant-gateway.manual-fulfillment]", error);
    return apiFailure(
      "Manual fulfillment stopped. Refresh the order before trying again. Do not purchase if TopTayo may already have been sent.",
      500,
    );
  }
}
