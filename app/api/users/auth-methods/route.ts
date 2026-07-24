import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { getAuthMethodBreakdown } from "@/lib/data/users";

export async function GET() {
  const { response } = await requireAdmin("viewer");
  if (response) return response;

  const data = await getAuthMethodBreakdown();
  return NextResponse.json({ data, error: null });
}
