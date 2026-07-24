import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { getOverviewSummary } from "@/lib/data/overview";

export async function GET() {
  const { response } = await requireAdmin("viewer");
  if (response) return response;

  const data = await getOverviewSummary();
  return NextResponse.json({ data, error: null });
}
