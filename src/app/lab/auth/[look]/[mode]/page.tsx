import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "../../../../(auth)/auth-form";
import { AuthFrame } from "../../../../(auth)/frame";
import { DaylightLook } from "../../../../(auth)/looks/daylight";
import { DialLook } from "../../../../(auth)/looks/dial";
import { ObjectsLook } from "../../../../(auth)/looks/objects";
import { TrailLook } from "../../../../(auth)/looks/trail";
import { WeekWallLook } from "../../../../(auth)/looks/week-wall";

export const metadata: Metadata = {
  title: "Auth concepts",
  robots: { index: false },
};

/** Concept panels for the sign-in and sign-up pages, side by side with the real form. */
const LOOKS = {
  daylight: { panel: <DaylightLook />, className: "bg-bg" },
  dial: { panel: <DialLook />, className: "bg-accent-soft" },
  trail: { panel: <TrailLook />, className: "bg-bg" },
  objects: { panel: <ObjectsLook />, className: "bg-accent-soft" },
  week: { panel: <WeekWallLook />, className: "bg-accent-soft" },
} as const;
const MODES = ["login", "signup"] as const;

export function generateStaticParams() {
  return Object.keys(LOOKS).flatMap((look) => MODES.map((mode) => ({ look, mode })));
}

export default function AuthLab({ params }: PageProps<"/lab/auth/[look]/[mode]">) {
  return (
    <Suspense>
      <Look params={params} />
    </Suspense>
  );
}

async function Look({ params }: { params: PageProps<"/lab/auth/[look]/[mode]">["params"] }) {
  const { look, mode } = await params;
  const l = LOOKS[look as keyof typeof LOOKS];
  if (!l || !MODES.includes(mode as (typeof MODES)[number])) notFound();
  return (
    <AuthFrame panel={l.panel} panelClassName={l.className}>
      <AuthForm mode={mode as (typeof MODES)[number]} />
    </AuthFrame>
  );
}
