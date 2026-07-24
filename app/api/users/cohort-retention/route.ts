import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { getCohortRetention } from "@/lib/data/users";
import { parseDateRange } from "@/lib/api/params";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin("viewer");
  if (response) return response;

  const { from, to } = parseDateRange(request, 60);
  const data = await getCohortRetention({ from, to });
  return NextResponse.json({ data, error: null });
}
