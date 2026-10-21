import { PageTransition } from "@/components/ui/motion";

// Remounts per top-level segment, so each tab switch gets a quick fade + rise.
// The animation is CSS only, so it plays before hydration and costs no JS.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
