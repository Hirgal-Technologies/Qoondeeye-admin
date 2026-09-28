import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getReconciliationContext } from "@/features/merchant-gateway/server/queries";
import { reconcileMerchantPayment } from "@/features/merchant-gateway/server/reconcile";
import {
  parseReconcileBody,
  reconciliationErrorMessage,
} from "@/features/merchant-gateway/presentation";
import { apiSuccess } from "@/lib/api/responses";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { requireAdmin } from "@/lib/auth/require";
import { getAdminAccessToken } from "@/lib/auth/session";

export const GET = createAdminGetHandler(
  {
    operation: "merchant-gateway.reconciliation",
    minimumRole: "admin",
    cacheTtlMs: 0,
  },
  () => getReconciliationContext(),
);

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin("admin");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = parseReconcileBody(body);
  if (!parsed.ok) return reconcileFailure(parsed.code, 400);

  const accessToken = await getAdminAccessToken();
  if (!accessToken) return reconcileFailure("unauthenticated", 401);

  try {
    const outcome = await reconcileMerchantPayment(accessToken, parsed.value);
    if (!outcome.ok) return reconcileFailure(outcome.code, outcome.status, outcome.message);
    return apiSuccess(outcome.result);
  } catch (error) {
    console.error("[api:merchant-gateway.reconcile]", error);
    return reconcileFailure("rejected", 500);
  }
}

function reconcileFailure(code: string, status: number, backendMessage?: string) {
  return NextResponse.json(
    {
      data: null,
      error: code,
      message: reconciliationErrorMessage(code, backendMessage),
    },
    { status },
  );
}
