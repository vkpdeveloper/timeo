import type { Viewport } from "next";
import "./focus.css";

export const viewport: Viewport = { themeColor: "#0a0a0b" };

/** Full-screen shell for focus mode: no tab bar, always dark, safe-area aware. */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="focus-theme fixed inset-0 overflow-y-auto overscroll-contain">
      <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col px-5 pt-[max(12px,var(--safe-top))] pb-[max(16px,var(--safe-bottom))]">
        {children}
      </div>
    </div>
  );
}
