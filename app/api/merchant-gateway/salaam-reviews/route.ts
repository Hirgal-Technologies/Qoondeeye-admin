import { listSalaamReviews } from "@/features/merchant-gateway/server/salaam-review";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { requireAdmin } from "@/lib/auth/require";

export async function GET() {
  const { response } = await requireAdmin("admin");
  if (response) return response;
  try {
    return apiSuccess(await listSalaamReviews());
  } catch (error) {
    console.error("[api:merchant-gateway.salaam-reviews]", error);
    return apiFailure("internal server error", 500);
  }
}
