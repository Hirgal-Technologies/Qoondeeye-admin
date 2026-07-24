import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { getCategoryDistribution } from "@/lib/data/finance";
import { parseDateRange } from "@/lib/api/params";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin("viewer");
  if (response) return response;

  const { from, to } = parseDateRange(request);
  const data = await getCategoryDistribution({ from, to });
  return NextResponse.json({ data, error: null });
}
