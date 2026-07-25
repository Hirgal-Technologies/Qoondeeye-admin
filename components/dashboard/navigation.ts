import {
  Activity,
  BookOpenCheck,
  Download,
  FileBarChart,
  Headphones,
  LayoutDashboard,
  Settings,
  ShieldUser,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { AdminRole } from "@/features/auth/contracts";
import { hasMinimumRole } from "@/lib/permissions";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  minimumRole?: AdminRole;
};

export type DashboardNavGroup = {
  label: string;
  items: DashboardNavItem[];
};

export const DASHBOARD_NAVIGATION: DashboardNavGroup[] = [
  {
    label: "Analytics",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/users", label: "User analytics", icon: Users },
      { href: "/dashboard/finance", label: "Financial activity", icon: WalletCards },
      { href: "/dashboard/system", label: "System health", icon: Activity },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/reports", label: "Reports", icon: FileBarChart },
      {
        href: "/dashboard/exports",
        label: "Data exports",
        icon: Download,
        minimumRole: "admin",
      },
      {
        href: "/dashboard/support",
        label: "Support tools",
        icon: Headphones,
        minimumRole: "support",
      },
      {
        href: "/dashboard/admin-users",
        label: "Admin users",
        icon: ShieldUser,
        minimumRole: "admin",
      },
      {
        href: "/dashboard/audit",
        label: "Audit logs",
        icon: BookOpenCheck,
        minimumRole: "admin",
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function navigationForRole(role: AdminRole) {
  return DASHBOARD_NAVIGATION.flatMap((group) => group.items).filter((item) =>
    hasMinimumRole(role, item.minimumRole ?? "viewer")
  );
}

export function dashboardPageTitle(pathname: string) {
  return (
    DASHBOARD_NAVIGATION.flatMap((group) => group.items).find(
      (item) => item.href === pathname
    )?.label ?? "Dashboard"
  );
}
