import type { Metadata } from "next";
import { LoginPage } from "@/features/auth/components/login-page";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in with your Qoondeeye admin account.",
};

export default function Page() {
  return <LoginPage />;
}
