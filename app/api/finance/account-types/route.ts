import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { getAccountTypeDistribution } from "@/lib/data/finance";

export async function GET() {
  const { response } = await requireAdmin("viewer");
  if (response) return response;

  const data = await getAccountTypeDistribution();
  return NextResponse.json({ data, error: null });
}
