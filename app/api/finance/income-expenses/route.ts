import { NextResponse, type NextRequest } from "next/server";
import { parseDateRange, parseGranularity } from "@/lib/api/params";
import { requireAdmin } from "@/lib/auth/require";
import { getIncomeExpenseTrend } from "@/lib/data/finance";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin("viewer");
  if (response) return response;

  const { from, to } = parseDateRange(request);
  const granularity = parseGranularity(request);
  const data = await getIncomeExpenseTrend({ from, to, granularity });
  return NextResponse.json({ data, error: null });
}
