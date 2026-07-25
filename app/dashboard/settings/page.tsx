import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsPage } from "@/features/settings/components/settings-page";
import { getAdminSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Settings",
  description: "Access, security posture, appearance, and notification readiness.",
};

export default async function Page() {
  const identity = await getAdminSession();
  if (!identity) redirect("/login");

  return <SettingsPage identity={identity} />;
}
