import { AskHost } from "@/components/shell/ask";
import { GlobalHotkeys } from "@/components/shell/hotkeys";

// Full-screen assistant: no tab bar, keyboard-friendly height.
export const maxDuration = 120;

export default function AssistantLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-bg">
      {children}
      <AskHost />
      <GlobalHotkeys />
    </div>
  );
}
