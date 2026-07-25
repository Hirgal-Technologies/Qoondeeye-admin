import type { NextRequest } from "next/server";
import { runSupportAccountAction } from "@/features/support/server/account-actions";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { requireAdmin } from "@/lib/auth/require";

export async function POST(request: NextRequest) {
  const { identity, response } = await requireAdmin("support");
  if (response) return response;

  const body = await request.json().catch(() => null);

  try {
    const result = await runSupportAccountAction(identity, body);
    if (!result.ok) {
      return result.reason === "not_found"
        ? apiFailure("user not found", 404)
        : apiFailure("invalid support action request", 400);
    }
    return apiSuccess(result.user);
  } catch (error) {
    console.error("[api:support.account-actions]", error);
    return apiFailure("The account action could not be completed.", 500);
  }
}
