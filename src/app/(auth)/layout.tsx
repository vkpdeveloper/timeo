import { AuthFrame } from "./frame";
import { AuthShowcase } from "./showcase";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <AuthFrame panel={<AuthShowcase />}>{children}</AuthFrame>;
}
