import type { Metadata } from "next";
import { SubHeader } from "@/components/ui/primitives";
import { ShortcutSettings } from "./shortcut-settings";

export const metadata: Metadata = { title: "Keyboard shortcuts" };

// Shortcuts live on the device (localStorage), so there is nothing to load here.
export default function ShortcutsPage() {
  return (
    <>
      <SubHeader back="/app/settings" backLabel="Settings" title="Keyboard shortcuts" />
      <ShortcutSettings />
    </>
  );
}
