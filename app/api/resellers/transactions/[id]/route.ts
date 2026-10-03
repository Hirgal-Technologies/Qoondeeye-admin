import { getTransaction } from "@/features/reseller/server/reseller-repository";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { requireAdmin } from "@/lib/auth/require";
import { ToptayoApiError } from "@/lib/toptayo/client";
import { isToptayoId } from "@/features/reseller/validation";

type RouteContext = { params: Promise<{ id: string }> };

/** Read-only TopTayo transaction lookup. Does not recharge or change an order. */
export async function GET(_request: Request, context: RouteContext) {
  const { response } = await requireAdmin("admin");
  if (response) return response;

  const { id } = await context.params;
  const transactionId = id.trim();
  if (!isToptayoId(transactionId)) {
    return apiFailure("invalid transaction id", 400);
  }

  try {
    const transaction = await getTransaction(transactionId);
    return apiSuccess(transaction);
  } catch (error) {
    if (error instanceof ToptayoApiError) {
      return apiFailure(
        error.status === 404 ? "TopTayo transaction was not found." : "TopTayo status unavailable",
        error.status === 404 ? 404 : 502,
      );
    }
    console.error("[api:resellers.transactions.get]", error);
    return apiFailure("TopTayo status unavailable", 502);
  }
}
