import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require";

export async function GET() {
  const { identity, response } = await requireAdmin("viewer");
  if (response) return response;
  return NextResponse.json({ data: identity, error: null });
}
