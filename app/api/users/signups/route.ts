import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { getSignupTrend } from "@/lib/data/users";
import { parseDateRange, parseGranularity } from "@/lib/api/params";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin("viewer");
  if (response) return response;

  const { from, to } = parseDateRange(request);
  const granularity = parseGranularity(request);
  const data = await getSignupTrend({ from, to, granularity });
  return NextResponse.json({ data, error: null });
}
