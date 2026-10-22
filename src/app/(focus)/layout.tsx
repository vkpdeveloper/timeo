import { AskHost } from "@/components/shell/ask";
import { GlobalHotkeys } from "@/components/shell/hotkeys";
import "./focus.css";

/** Full-screen shell for focus mode: no tab bar, safe-area aware. Follows Light / Dark like the rest of the app. */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-y-auto overscroll-contain bg-bg text-ink">
      <div className="flex min-h-full w-full flex-col px-5 pt-[max(12px,var(--safe-top))] pb-[max(16px,var(--safe-bottom))]">
        {children}
      </div>
      <AskHost />
      <GlobalHotkeys />
    </div>
  );
}
