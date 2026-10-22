import type { Metadata } from "next";
import { googleSignInEnabled } from "@/lib/google-auth";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return <AuthForm google={googleSignInEnabled()} />;
}
