import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton, SubHeader } from "@/components/ui/primitives";
import { getAppearance, listUserThemes } from "@/lib/appearance";
import { requireUser } from "@/lib/auth";
import { AppearancePicker } from "./appearance-picker";

export const metadata: Metadata = { title: "Appearance" };

export default function AppearancePage() {
  return (
    <>
      <SubHeader back="/settings" backLabel="Settings" title="Appearance" />
      <div className="pt-5">
        <Suspense fallback={<AppearanceSkeleton />}>
          <AppearanceContent />
        </Suspense>
      </div>
    </>
  );
}

async function AppearanceContent() {
  const user = await requireUser();
  const [appearance, themes] = await Promise.all([getAppearance(user.id), listUserThemes(user.id)]);
  return <AppearancePicker initialTheme={appearance.theme} initialMode={appearance.mode} customThemes={themes} />;
}

function AppearanceSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-44 rounded-[22px]" />
      <Skeleton className="h-11" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-[18px]" />
        ))}
      </div>
    </div>
  );
}
