import type { Metadata } from "next";
import { UsersPage } from "@/features/analytics/users/components/users-page";

export const metadata: Metadata = {
  title: "User analytics",
  description: "Acquisition, authentication, engagement, retention, and churn analytics.",
};

export default function Page() {
  return <UsersPage />;
}
