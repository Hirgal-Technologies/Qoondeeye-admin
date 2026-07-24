import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { getRetentionCurve } from "@/lib/data/overview";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin("viewer");
  if (response) return response;

  const cohortWindow = Number(request.nextUrl.searchParams.get("cohortWindow") ?? "30");
  const data = await getRetentionCurve(cohortWindow);
  return NextResponse.json({ data, error: null });
}
