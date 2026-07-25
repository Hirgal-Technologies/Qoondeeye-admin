import type { AdminRole } from "@/features/auth/contracts";

export type AdminUserRow = {
  id: string;
  email: string;
  role: AdminRole;
  createdAt: string;
};

export type CreateAdminUserInput = {
  email: string;
  role: AdminRole;
  password?: string;
};

export type UpdateAdminUserInput = {
  email: string;
  role: AdminRole;
};
