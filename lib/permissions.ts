export type AdminRole = "admin" | "support" | "viewer";

const ROLE_RANK: Record<AdminRole, number> = {
  viewer: 0,
  support: 1,
  admin: 2,
};

export function hasMinimumRole(role: AdminRole, minimumRole: AdminRole) {
  return ROLE_RANK[role] >= ROLE_RANK[minimumRole];
}
