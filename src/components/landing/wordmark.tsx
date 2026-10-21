import Link from "next/link";
import { LogoMark } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { LANDING_HREF } from "./links";

/** "Timeo" with its mark, linking home. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href={LANDING_HREF} aria-label="Timeo home" className={cn("tap -ml-1 flex h-11 items-center gap-2 px-1 text-ink", className)}>
      <LogoMark size={22} />
      <span className="text-[17px] font-semibold tracking-[-0.02em]">Timeo</span>
    </Link>
  );
}
