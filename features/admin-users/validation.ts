import type {
  CreateAdminUserInput,
  UpdateAdminUserInput,
} from "@/features/admin-users/contracts";
import type { AdminRole } from "@/features/auth/contracts";

const ADMIN_ROLES = new Set<AdminRole>(["admin", "support", "viewer"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UnknownAdminUserBody = {
  email?: unknown;
  role?: unknown;
  password?: unknown;
};

function parseEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

function parseRole(value: unknown): AdminRole | null {
  return typeof value === "string" && ADMIN_ROLES.has(value as AdminRole)
    ? (value as AdminRole)
    : null;
}

export function parseCreateAdminUserInput(
  body: unknown
): CreateAdminUserInput | null {
  const candidate = body as UnknownAdminUserBody | null;
  const email = parseEmail(candidate?.email);
  const role = parseRole(candidate?.role);
  const rawPassword =
    typeof candidate?.password === "string" ? candidate.password : "";

  if (!email || !role || rawPassword.length > 72) return null;
  if (rawPassword && rawPassword.length < 8) return null;

  return {
    email,
    role,
    ...(rawPassword ? { password: rawPassword } : {}),
  };
}

export function parseUpdateAdminUserInput(
  body: unknown
): UpdateAdminUserInput | null {
  const candidate = body as UnknownAdminUserBody | null;
  const email = parseEmail(candidate?.email);
  const role = parseRole(candidate?.role);
  return email && role ? { email, role } : null;
}

export function isAdminUserId(value: string) {
  return UUID_PATTERN.test(value);
}
