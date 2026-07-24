import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { getAuditLogs } from "@/lib/data/audit";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin("admin");
  if (response) return response;

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 500)
    : 100;
  const data = await getAuditLogs(limit);
  return NextResponse.json({ data, error: null });
}
