import { NextResponse, type NextRequest } from "next/server";
import { parseDateRange } from "@/lib/api/params";
import { requireAdmin } from "@/lib/auth/require";
import { getActiveUsersTrend } from "@/lib/data/overview";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin("viewer");
  if (response) return response;

  const { from, to } = parseDateRange(request);
  const data = await getActiveUsersTrend({ from, to });
  return NextResponse.json({ data, error: null });
}
