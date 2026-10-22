import type { Metadata } from "next";
import { googleSignInEnabled } from "@/lib/google-auth";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <AuthForm google={googleSignInEnabled()} />;
}
