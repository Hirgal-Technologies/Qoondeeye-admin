import type { NextRequest } from "next/server";
import { lookupSupportUser } from "@/features/support/server/lookup-user";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { requireAdmin } from "@/lib/auth/require";

export async function POST(request: NextRequest) {
  const { identity, response } = await requireAdmin("support");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const result = await lookupSupportUser(identity, body);

  if (!result.ok) {
    return result.reason === "not_found"
      ? apiFailure("user not found", 404)
      : apiFailure("invalid support access request", 400);
  }

  return apiSuccess(result.user);
}
