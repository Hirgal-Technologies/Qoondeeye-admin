import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { exportRegistry, PER_USER_SOURCES, type ExportSource } from "@/lib/api/export-registry";
import { rowsToCsv } from "@/lib/csv";
import { writeAuditLog } from "@/lib/data/audit";

export async function GET(request: NextRequest) {
  const { identity, response } = await requireAdmin("viewer");
  if (response) return response;

  const source = request.nextUrl.searchParams.get("source") as ExportSource | null;
  if (!source || !(source in exportRegistry)) {
    return NextResponse.json({ data: null, error: "unknown source" }, { status: 400 });
  }

  const rows = await exportRegistry[source](request);
  const csv = rowsToCsv(rows);

  if (PER_USER_SOURCES.has(source)) {
    await writeAuditLog({ actorId: identity!.id, action: "csv_export", metadata: { source } });
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${source.replace(/\//g, "-")}.csv"`,
    },
  });
}
