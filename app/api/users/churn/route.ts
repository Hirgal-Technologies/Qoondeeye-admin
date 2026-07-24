import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { getChurn } from "@/lib/data/users";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin("viewer");
  if (response) return response;

  const inactiveDays = Number(request.nextUrl.searchParams.get("inactiveDays") ?? "30");
  const data = await getChurn(inactiveDays);
  return NextResponse.json({ data, error: null });
}
