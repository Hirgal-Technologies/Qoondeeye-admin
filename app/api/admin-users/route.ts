import type { NextRequest } from "next/server";
import {
  AdminUserError,
  createAdminUser,
  getAdminUsers,
} from "@/features/admin-users/server/admin-users-repository";
import { parseCreateAdminUserInput } from "@/features/admin-users/validation";
import { createAdminGetHandler } from "@/lib/api/admin-route";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { requireAdmin } from "@/lib/auth/require";

export const GET = createAdminGetHandler(
  { operation: "admin-users.list", minimumRole: "admin", cacheTtlMs: 0 },
  () => getAdminUsers()
);

export async function POST(request: NextRequest) {
  const { identity, response } = await requireAdmin("admin");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const input = parseCreateAdminUserInput(body);
  if (!input) {
    return apiFailure(
      "Enter a valid email, role, and optional 8–72 character password.",
      400
    );
  }

  try {
    const result = await createAdminUser(identity, input);
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    if (error instanceof AdminUserError) {
      if (error.code === "already_exists") {
        return apiFailure("An admin user with this email already exists.", 409);
      }
      if (error.code === "auth_user_not_found") {
        return apiFailure(
          "No Supabase Auth account has this email. Add a temporary password to create one.",
          404
        );
      }
      if (error.code === "role_constraint_outdated") {
        return apiFailure(
          "The database role constraint is outdated. Apply migration 0003_admin_user_crud.sql.",
          409
        );
      }
    }
    console.error("[api:admin-users.create]", error);
    return apiFailure("The admin user could not be created.", 500);
  }
}
