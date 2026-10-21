import { ThemeSync } from "@/components/shell/theme";

/** First run: full screen, no tab bar or rail. Follows Light / Dark like the rest of the app. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-contain bg-bg text-ink">
      {children}
      <ThemeSync />
    </div>
  );
}
