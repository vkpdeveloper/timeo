import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { cn } from "@/lib/cn";
import { APP_HREF } from "./links";

const SESSION_COOKIE = "timeo_session";

const big = "tap inline-flex h-12 items-center justify-center rounded-full px-6 text-[15px] font-semibold tracking-[-0.01em]";
const small = "tap inline-flex h-10 items-center justify-center rounded-full px-4 text-[14px] font-semibold tracking-[-0.01em]";
const primary = "bg-accent text-accent-ink hover:opacity-90 active:opacity-85";
const quiet = "border border-line-strong text-ink hover:bg-sunken active:bg-sunken";

type Variant = "nav" | "hero" | "final";

function Links({ variant, signedIn }: { variant: Variant; signedIn: boolean }) {
  if (variant === "nav")
    return signedIn ? (
      <Link href={APP_HREF} className={cn(small, primary)}>
        Open Timeo
      </Link>
    ) : (
      <>
        <Link href="/login" className={cn(small, "font-medium text-ink-2 hover:text-ink")}>
          Sign in
        </Link>
        <Link href="/signup" className={cn(small, primary)}>
          Get started
        </Link>
      </>
    );

  if (signedIn)
    return (
      <Link href={APP_HREF} className={cn(big, primary, "min-w-40")}>
        Open Timeo
      </Link>
    );

  return (
    <>
      <Link href="/signup" className={cn(big, primary, "min-w-36")}>
        Start free
      </Link>
      {variant === "hero" ? (
        <Link href="/login" className={cn(big, quiet, "min-w-36")}>
          Sign in
        </Link>
      ) : null}
    </>
  );
}

async function SessionLinks({ variant }: { variant: Variant }) {
  // Optimistic: the cookie only picks the buttons; the app checks the session itself
  const signedIn = (await cookies()).has(SESSION_COOKIE);
  return <Links variant={variant} signedIn={signedIn} />;
}

/** Calls to action: start / sign in when signed out, "Open Timeo" when signed in. */
export function Cta({ variant, className }: { variant: Variant; className?: string }) {
  return (
    <div className={cn("flex items-center", variant === "nav" ? "gap-1" : "flex-wrap justify-center gap-3", className)}>
      <Suspense fallback={<Links variant={variant} signedIn={false} />}>
        <SessionLinks variant={variant} />
      </Suspense>
    </div>
  );
}
