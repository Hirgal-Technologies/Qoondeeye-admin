import type { NextRequest } from "next/server";
import { runRecharge } from "@/features/reseller/server/recharge";
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
      return apiFailure(result.message, result.status);
    }
    return apiSuccess(
      { message: result.message, transactionIds: result.transactionIds },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api:resellers.recharge]", error);
    return apiFailure("The recharge could not be completed.", 500);
  }
}
