import { listMerchantPayments } from "@/features/merchant-gateway/server/queries";
import { parsePaymentReviewFilter } from "@/features/merchant-gateway/presentation";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { requireAdmin } from "@/lib/auth/require";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin("admin");
  if (response) return response;

  const status = parsePaymentReviewFilter(request.nextUrl.searchParams.get("status"));
  if (!status) return apiFailure("invalid payment status", 400);

  try {
    return apiSuccess(await listMerchantPayments(status));
  } catch (error) {
    console.error("[api:merchant-gateway.payments]", error);
    return apiFailure("internal server error", 500);
  }
}
