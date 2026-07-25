export type AdminRole = "admin" | "support" | "viewer";

export type AdminIdentity = {
  id: string;
  email: string;
  role: AdminRole;
};
