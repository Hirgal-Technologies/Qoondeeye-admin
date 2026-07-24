import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { getRecentErrors } from "@/lib/data/system";
import { parseDateRange } from "@/lib/api/params";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin("viewer");
  if (response) return response;

  const { from, to } = parseDateRange(request);
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "100");
  const data = await getRecentErrors({ from, to, limit });
  return NextResponse.json({ data, error: null });
}
