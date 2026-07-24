import type { NextRequest } from "next/server";
import type { Granularity } from "@/lib/data/types";

export function parseDateRange(request: NextRequest, defaultDays = 30) {
  const searchParams = request.nextUrl.searchParams;
  const to = searchParams.get("to") ?? new Date().toISOString();
  const from =
    searchParams.get("from") ??
    new Date(Date.now() - defaultDays * 86_400_000).toISOString();
  return { from, to };
}

export function parseGranularity(request: NextRequest): Granularity {
  const g = request.nextUrl.searchParams.get("granularity");
  return g === "week" || g === "month" ? g : "day";
}
