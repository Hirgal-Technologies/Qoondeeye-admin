import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");

  return <DashboardShell identity={identity}>{children}</DashboardShell>;
}
