import Image from "next/image";
import Link from "next/link";
import { Cta } from "./cta";
import { Glow, Reveal, SeasonRings, Words } from "./motion";
import { LANDING_HREF } from "./links";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-line">
      <Glow className="top-1/2 left-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 opacity-80" />
      <div className="absolute inset-0 flex items-center justify-center">
        <SeasonRings weeks={12} className="size-[620px] shrink-0 opacity-45 sm:size-[760px]" />
      </div>
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 py-28 text-center sm:py-40">
        <h2 className="display text-[42px] leading-[1.0] tracking-[-0.02em] text-balance sm:text-[68px]">
          <Words text="Twelve weeks from now," inView />
          <br />
          <Words text="know where the time went." inView delay={0.3} accentFrom={0} />
        </h2>
        <Reveal delay={0.4}>
          <p className="mt-6 max-w-[36ch] text-[17px] leading-relaxed text-ink-2">
            Start with one season and two goals. It takes five minutes.
          </p>
        </Reveal>
        <Reveal delay={0.5} className="mt-9">
          <Cta variant="final" className="justify-center" />
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 pt-10 pb-[max(40px,calc(var(--safe-bottom)+24px))] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link href={LANDING_HREF} className="flex items-center gap-2.5">
          <Image src="/icon-192.png" alt="" width={24} height={24} className="rounded-[7px]" />
          <span className="display text-[19px] leading-none">Timeo</span>
          <span className="ml-2 text-[13px] text-ink-3">Goal · Plan · System</span>
        </Link>
        <nav className="-ml-3 flex items-center gap-1 text-[14px] text-ink-2 sm:ml-0">
          <Link href="/login" className="inline-flex h-11 items-center px-3 hover:text-ink">
            Sign in
          </Link>
          <Link href="/signup" className="inline-flex h-11 items-center px-3 hover:text-ink">
            Get started
          </Link>
          <span className="pl-3 text-ink-3">© 2026</span>
        </nav>
      </div>
    </footer>
  );
}
