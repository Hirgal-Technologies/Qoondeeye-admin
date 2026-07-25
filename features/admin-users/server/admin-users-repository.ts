import "server-only";
import type {
  AdminUserRow,
  CreateAdminUserInput,
  UpdateAdminUserInput,
} from "@/features/admin-users/contracts";
import type { AdminIdentity, AdminRole } from "@/features/auth/contracts";
import { writeAuditLog } from "@/features/audit/server/audit-repository";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminUserErrorCode =
  | "already_exists"
  | "auth_user_not_found"
  | "cannot_change_own_role"
  | "cannot_delete_self"
  | "not_found"
  | "role_constraint_outdated"
  | "write_failed";

export class AdminUserError extends Error {
  constructor(public readonly code: AdminUserErrorCode) {
    super(code);
    this.name = "AdminUserError";
  }
}

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_users")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    email: String(row.email),
    role: row.role as AdminRole,
    createdAt: String(row.created_at),
  }));
}

export async function createAdminUser(
  actor: AdminIdentity,
  input: CreateAdminUserInput
) {
  const db = createAdminClient();
  const { data: rosterMatch, error: rosterError } = await db
    .from("admin_users")
    .select("id")
    .eq("email", input.email)
    .maybeSingle();

  if (rosterError) throw rosterError;
  if (rosterMatch) throw new AdminUserError("already_exists");

  let authUser = await findAuthUserByEmail(input.email);
  let createdAuthAccount = false;

  if (!authUser) {
    if (!input.password) throw new AdminUserError("auth_user_not_found");

    const { data, error } = await db.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new AdminUserError("write_failed");
    authUser = data.user;
    createdAuthAccount = true;
  }

  const { error: insertError } = await db.from("admin_users").insert({
    id: authUser.id,
    email: input.email,
    role: input.role,
  });

  if (insertError) {
    if (createdAuthAccount) {
      await db.auth.admin.deleteUser(authUser.id).catch(() => undefined);
    }
    if (insertError.code === "23505") {
      throw new AdminUserError("already_exists");
    }
    if (insertError.code === "23514") {
      throw new AdminUserError("role_constraint_outdated");
    }
    throw insertError;
  }

  await writeAdminUserAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "admin_user_created",
    targetUserId: authUser.id,
    metadata: {
      resource: "Admin users",
      outcome: "Completed",
      targetEmail: input.email,
      role: input.role,
      createdAuthAccount,
    },
  });

  return { id: authUser.id };
}

export async function updateAdminUser(
  actor: AdminIdentity,
  targetId: string,
  input: UpdateAdminUserInput
) {
  const db = createAdminClient();
  const { data: current, error: findError } = await db
    .from("admin_users")
    .select("id, email, role")
    .eq("id", targetId)
    .maybeSingle();

  if (findError) throw findError;
  if (!current) throw new AdminUserError("not_found");
  if (targetId === actor.id && input.role !== "admin") {
    throw new AdminUserError("cannot_change_own_role");
  }

  const previousEmail = String(current.email);
  const emailChanged = previousEmail.toLowerCase() !== input.email;

  if (emailChanged) {
    const { error: authError } = await db.auth.admin.updateUserById(targetId, {
      email: input.email,
      email_confirm: true,
    });
    if (authError) throw authError;
  }

  const { error: updateError } = await db
    .from("admin_users")
    .update({ email: input.email, role: input.role })
    .eq("id", targetId);

  if (updateError) {
    if (emailChanged) {
      await db.auth.admin
        .updateUserById(targetId, {
          email: previousEmail,
          email_confirm: true,
        })
        .catch(() => undefined);
    }
    if (updateError.code === "23505") {
      throw new AdminUserError("already_exists");
    }
    if (updateError.code === "23514") {
      throw new AdminUserError("role_constraint_outdated");
    }
    throw updateError;
  }

  await writeAdminUserAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "admin_user_updated",
    targetUserId: targetId,
    metadata: {
      resource: "Admin users",
      outcome: "Completed",
      targetEmail: input.email,
      previousEmail,
      previousRole: current.role,
      role: input.role,
    },
  });
}

export async function deleteAdminUser(
  actor: AdminIdentity,
  targetId: string
) {
  if (targetId === actor.id) {
    throw new AdminUserError("cannot_delete_self");
  }

  const db = createAdminClient();
  const { data: current, error: findError } = await db
    .from("admin_users")
    .select("id, email, role")
    .eq("id", targetId)
    .maybeSingle();

  if (findError) throw findError;
  if (!current) throw new AdminUserError("not_found");

  const { error: deleteError } = await db
    .from("admin_users")
    .delete()
    .eq("id", targetId);
  if (deleteError) throw deleteError;

  await writeAdminUserAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "admin_user_deleted",
    targetUserId: targetId,
    metadata: {
      resource: "Admin users",
      outcome: "Completed",
      targetEmail: current.email,
      previousRole: current.role,
    },
  });
}

export async function findAuthUserByEmail(email: string) {
  const db = createAdminClient();
  let page = 1;

  while (true) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email
    );
    if (match) return match;
    if (!data.nextPage) return null;
    page = data.nextPage;
  }
}

async function writeAdminUserAudit(
  entry: Parameters<typeof writeAuditLog>[0]
) {
  try {
    await writeAuditLog(entry);
  } catch (error) {
    // The roster mutation has already completed and cannot share a transaction
    // with Supabase Auth. Do not tell the client it failed and encourage a
    // duplicate retry; surface the infrastructure problem in server logs.
    console.error("[admin-users:audit]", error);
  }
}
