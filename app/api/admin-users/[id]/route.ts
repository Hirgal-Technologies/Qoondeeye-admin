import type { NextRequest } from "next/server";
import {
  AdminUserError,
  deleteAdminUser,
  updateAdminUser,
} from "@/features/admin-users/server/admin-users-repository";
import {
  isAdminUserId,
  parseUpdateAdminUserInput,
} from "@/features/admin-users/validation";
import { apiFailure, apiSuccess } from "@/lib/api/responses";
import { requireAdmin } from "@/lib/auth/require";

type AdminUserRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: AdminUserRouteContext
) {
  const { identity, response } = await requireAdmin("admin");
  if (response) return response;

  const { id } = await context.params;
  if (!isAdminUserId(id)) return apiFailure("Invalid admin user ID.", 400);

  const body = await request.json().catch(() => null);
  const input = parseUpdateAdminUserInput(body);
  if (!input) return apiFailure("Enter a valid email and role.", 400);

  try {
    await updateAdminUser(identity, id, input);
    return apiSuccess({ id });
  } catch (error) {
    return handleAdminUserError(error, "update");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: AdminUserRouteContext
) {
  const { identity, response } = await requireAdmin("admin");
  if (response) return response;

  const { id } = await context.params;
  if (!isAdminUserId(id)) return apiFailure("Invalid admin user ID.", 400);

  try {
    await deleteAdminUser(identity, id);
    return apiSuccess({ id });
  } catch (error) {
    return handleAdminUserError(error, "delete");
  }
}

function handleAdminUserError(error: unknown, operation: "update" | "delete") {
  if (error instanceof AdminUserError) {
    if (error.code === "not_found") {
      return apiFailure("Admin user not found.", 404);
    }
    if (error.code === "already_exists") {
      return apiFailure("An admin user with this email already exists.", 409);
    }
    if (error.code === "cannot_change_own_role") {
      return apiFailure("You cannot remove your own administrator role.", 409);
    }
    if (error.code === "cannot_delete_self") {
      return apiFailure("You cannot revoke your own dashboard access.", 409);
    }
    if (error.code === "role_constraint_outdated") {
      return apiFailure(
        "The database role constraint is outdated. Apply migration 0003_admin_user_crud.sql.",
        409
      );
    }
  }

  console.error(`[api:admin-users.${operation}]`, error);
  return apiFailure(`The admin user could not be ${operation}d.`, 500);
}
