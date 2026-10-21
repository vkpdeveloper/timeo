import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * CSS-only phone: bezel, dynamic island, status bar and a 390x844 screenshot.
 * Size it with a width (or a height) class; everything inside scales with it (cqw units).
 * Pass `children` instead of `src` to show several stacked screens (see the feature tour).
 */
export function PhoneFrame({
  src,
  alt = "",
  sizes = "300px",
  priority = false,
  screenBg = "#0b0b0c",
  className,
  children,
}: {
  src?: string;
  alt?: string;
  sizes?: string;
  priority?: boolean;
  /** Colour behind the status bar; match the screenshots' background */
  screenBg?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("@container relative aspect-[390/844]", className)}>
      {/* side buttons */}
      <span aria-hidden className="absolute top-[22%] -left-[0.9cqw] h-[7%] w-[1.2cqw] rounded-l-full bg-[#3a3a3f]" />
      <span aria-hidden className="absolute top-[31%] -left-[0.9cqw] h-[11%] w-[1.2cqw] rounded-l-full bg-[#3a3a3f]" />
      <span aria-hidden className="absolute top-[27%] -right-[0.9cqw] h-[15%] w-[1.2cqw] rounded-r-full bg-[#3a3a3f]" />

      <div
        className="absolute inset-0 rounded-[15cqw] p-[3.4cqw]"
        style={{
          background: "linear-gradient(150deg, #4a4a50 0%, #1c1c1f 22%, #111113 60%, #2c2c31 100%)",
          boxShadow:
            "inset 0 0 0 0.4cqw rgb(255 255 255 / 0.10), inset 0 0 0 1.3cqw #08080a, 0 50px 100px -30px rgb(0 0 0 / 0.55), 0 20px 40px -20px rgb(0 0 0 / 0.35)",
        }}
      >
        <div className="relative size-full overflow-hidden rounded-[12cqw]" style={{ background: screenBg }}>
          {/* status bar */}
          <div className="absolute inset-x-0 top-0 z-20 flex h-[12.5cqw] items-center justify-between px-[8cqw] text-[3.7cqw] font-semibold text-white/90">
            <span className="tnum">9:41</span>
            <span className="flex items-center gap-[1.4cqw]" aria-hidden>
              <span className="flex items-end gap-[0.5cqw]">
                {[1.6, 2.2, 2.8, 3.4].map((h) => (
                  <span key={h} className="w-[0.8cqw] rounded-[0.3cqw] bg-white/90" style={{ height: `${h}cqw` }} />
                ))}
              </span>
              <span className="relative h-[3.2cqw] w-[6.4cqw] rounded-[1cqw] border-[0.35cqw] border-white/50 p-[0.35cqw]">
                <span className="block h-full w-[70%] rounded-[0.5cqw] bg-white/90" />
              </span>
            </span>
          </div>
          {/* dynamic island */}
          <div aria-hidden className="absolute top-[3cqw] left-1/2 z-30 h-[8.4cqw] w-[29cqw] -translate-x-1/2 rounded-full bg-black" />

          <div className="absolute inset-x-0 top-[12.5cqw] bottom-0">
            {src ? (
              <Image
                src={src}
                alt={alt}
                fill
                sizes={sizes}
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : "auto"}
                className="object-cover object-top"
              />
            ) : (
              children
            )}
          </div>
          {/* home indicator */}
          <div aria-hidden className="absolute bottom-[2cqw] left-1/2 z-20 h-[1.2cqw] w-[34cqw] -translate-x-1/2 rounded-full bg-white/70" />
          {/* glass sheen */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10"
            style={{ background: "linear-gradient(115deg, rgb(255 255 255 / 0.07) 0%, transparent 32%)" }}
          />
        </div>
      </div>
    </div>
  );
}

/** A browser window around a desktop screenshot (1440x900). */
export function BrowserFrame({ src, alt, sizes, className }: { src: string; alt: string; sizes: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[14px] border border-line-strong bg-surface shadow-float sm:rounded-[18px]", className)}>
      <div className="flex h-8 items-center gap-1.5 border-b border-line px-3 sm:h-10 sm:px-4">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="mx-auto hidden rounded-md bg-sunken px-16 py-1 text-[11px] text-ink-3 sm:block">timeo.ordinity.com</span>
        <span className="hidden w-[46px] sm:block" />
      </div>
      <div className="relative aspect-[1440/900] bg-[#0b0b0c]">
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover object-top" />
      </div>
    </div>
  );
}
