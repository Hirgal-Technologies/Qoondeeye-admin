import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { exportRegistry, PER_USER_SOURCES, type ExportSource } from "@/lib/api/export-registry";
import { rowsToCsv } from "@/lib/csv";
import { ApiError, apiFailure } from "@/lib/api/responses";
import { writeAuditLog } from "@/features/audit/server/audit-repository";

export async function GET(request: NextRequest) {
  const { identity, response } = await requireAdmin("viewer");
  if (response) return response;

  const source = request.nextUrl.searchParams.get("source") as ExportSource | null;
  if (!source || !Object.hasOwn(exportRegistry, source)) {
    return apiFailure("unknown source", 400);
  }

  let rows: Record<string, unknown>[];
  try {
    rows = await exportRegistry[source](request);
  } catch (error) {
    if (error instanceof ApiError) return apiFailure(error.message, error.status);
    console.error(`[api:export.csv:${source}]`, error);
    return apiFailure("internal server error", 500);
  }
  const csv = rowsToCsv(rows);

  if (PER_USER_SOURCES.has(source)) {
    await writeAuditLog({
      actorId: identity!.id,
      actorEmail: identity!.email,
      actorRole: identity!.role,
      action: "csv_export",
      metadata: { source },
    });
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${source.replace(/\//g, "-")}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
