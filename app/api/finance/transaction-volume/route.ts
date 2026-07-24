import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { getTransactionVolume } from "@/lib/data/finance";
import { parseDateRange, parseGranularity } from "@/lib/api/params";
import type { TxType } from "@/lib/data/types";

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin("viewer");
  if (response) return response;

  const { from, to } = parseDateRange(request);
  const granularity = parseGranularity(request);
  const typeParam = request.nextUrl.searchParams.get("type");
  const type =
    typeParam === "expense" || typeParam === "income" || typeParam === "transfer"
      ? (typeParam as TxType)
      : undefined;

  const data = await getTransactionVolume({ from, to, granularity, type });
  return NextResponse.json({ data, error: null });
}
