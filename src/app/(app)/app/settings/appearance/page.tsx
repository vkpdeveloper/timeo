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
      <SubHeader back="/app/settings" backLabel="Settings" title="Appearance" />
      <div className="pt-4">
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
    <div>
      <Skeleton className="h-[214px] rounded-[22px]" />
      <Skeleton className="mt-6 h-12" />
      <div className="mt-6 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-[16px]" />
        ))}
      </div>
    </div>
  );
}
