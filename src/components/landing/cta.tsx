import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { APP_HREF } from "./links";

const SESSION_COOKIE = "timeo_session";

const primary =
  "tap inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-[15px] font-semibold text-accent-ink shadow-[0_10px_30px_-10px_color-mix(in_oklab,var(--accent)_70%,transparent)] hover:brightness-105";
const secondary =
  "tap inline-flex h-12 items-center justify-center rounded-full border border-line-strong bg-surface/60 px-6 text-[15px] font-medium text-ink hover:bg-surface";

type Variant = "nav" | "hero" | "final";

function Links({ variant, signedIn }: { variant: Variant; signedIn: boolean }) {
  if (variant === "nav") {
    return signedIn ? (
      <Link href={APP_HREF} className="tap inline-flex h-11 items-center rounded-full bg-accent px-4 text-[14px] font-semibold text-accent-ink">
        Open Timeo
      </Link>
    ) : (
      <>
        <Link href="/login" className="tap inline-flex h-11 items-center rounded-full px-3 text-[14px] font-medium text-ink-2 hover:text-ink">
          Sign in
        </Link>
        <Link href="/signup" className="tap inline-flex h-11 items-center rounded-full bg-accent px-4 text-[14px] font-semibold text-accent-ink">
          Get started
        </Link>
      </>
    );
  }
  return signedIn ? (
    <Link href={APP_HREF} className={primary}>
      Open Timeo <ArrowRight className="size-4" strokeWidth={2.2} />
    </Link>
  ) : (
    <>
      <Link href="/signup" className={primary}>
        Start your season <ArrowRight className="size-4" strokeWidth={2.2} />
      </Link>
      {variant === "hero" ? (
        <Link href="/login" className={secondary}>
          Sign in
        </Link>
      ) : null}
    </>
  );
}

async function SessionLinks({ variant }: { variant: Variant }) {
  // Optimistic: the cookie only decides which button to show; the app checks the session itself
  const signedIn = (await cookies()).has(SESSION_COOKIE);
  return <Links variant={variant} signedIn={signedIn} />;
}

/** Calls to action: sign up / sign in when signed out, "Open Timeo" when signed in. */
export function Cta({ variant, className }: { variant: Variant; className?: string }) {
  return (
    <div className={cn("flex items-center", variant === "nav" ? "gap-1" : "flex-wrap gap-3", className)}>
      <Suspense fallback={<Links variant={variant} signedIn={false} />}>
        <SessionLinks variant={variant} />
      </Suspense>
    </div>
  );
}
