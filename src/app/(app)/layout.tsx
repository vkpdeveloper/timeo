import { Suspense } from "react";
import { Sidebar, TabBar } from "@/components/shell/nav";
import { ThemeSync } from "@/components/shell/theme";

// AI commands can take a while on high reasoning effort
export const maxDuration = 120;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={<div className="hidden w-60 shrink-0 lg:block" />}>
        <Sidebar />
      </Suspense>
      <main className="pb-tabbar min-w-0 flex-1 px-4 pt-safe sm:px-6">
        <div className="mx-auto w-full max-w-[640px] lg:max-w-[760px]">{children}</div>
      </main>
      <Suspense>
        <TabBar />
      </Suspense>
      <ThemeSync />
    </div>
  );
}
