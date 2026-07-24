import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require";
import { writeAuditLog } from "@/lib/data/audit";
import { createAdminClient } from "@/lib/supabase/admin";

type LookupBody = {
  userId?: unknown;
  reason?: unknown;
  permissionConfirmed?: unknown;
};

export async function POST(request: NextRequest) {
  const { identity, response } = await requireAdmin("support");
  if (response) return response;

  const body = (await request.json().catch(() => null)) as LookupBody | null;
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const permissionConfirmed = body?.permissionConfirmed === true;

  if (!isUuid(userId) || reason.length < 20 || !permissionConfirmed) {
    return NextResponse.json(
      { data: null, error: "invalid support access request" },
      { status: 400 }
    );
  }

  const db = createAdminClient();
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) {
    await writeAuditLog({
      actorId: identity!.id,
      action: "support_user_lookup",
      targetUserId: userId,
      metadata: { reason, outcome: "Not found" },
    });
    return NextResponse.json({ data: null, error: "user not found" }, { status: 404 });
  }

  await writeAuditLog({
    actorId: identity!.id,
    action: "support_user_lookup",
    targetUserId: userId,
    metadata: { reason, outcome: "Completed" },
  });

  return NextResponse.json({
    data: {
      id: data.user.id,
      email: data.user.email ?? "Unavailable",
      createdAt: data.user.created_at,
      lastSignInAt: data.user.last_sign_in_at ?? null,
      providers: (data.user.identities ?? [])
        .map((identityRecord) => identityRecord.provider)
        .filter(Boolean),
    },
    error: null,
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
