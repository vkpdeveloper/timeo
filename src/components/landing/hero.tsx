import { Cta } from "./cta";
import { DotField } from "./dot-field";

export function Hero() {
  return (
    <section className="relative flex min-h-svh items-center justify-center overflow-hidden px-6 pt-[calc(4rem+var(--safe-top,0px))] pb-16">
      <DotField />
      <div data-dots-clear className="relative mx-auto flex max-w-[58rem] flex-col items-center text-center">
        <h1 className="l-in font-display text-[44px] leading-[1.02] font-bold tracking-[-0.04em] text-balance text-ink sm:text-[64px] lg:text-[76px]">
          Put your hours where your goals are.
        </h1>
        <p
          className="l-in mt-6 max-w-[34rem] text-[17px] leading-[1.55] text-pretty text-ink-2 sm:text-[19px]"
          style={{ "--d": "120ms" } as React.CSSProperties}
        >
          Choose two or three goals for a 12-week season. Timeo turns them into time blocks and focus sessions, with an assistant
          that plans with you.
        </p>
        <div className="l-in mt-9" style={{ "--d": "240ms" } as React.CSSProperties}>
          <Cta variant="hero" />
        </div>
        <p className="l-in mt-5 text-[13px] text-ink-3" style={{ "--d": "360ms" } as React.CSSProperties}>
          Free. Installs on your phone like an app.
        </p>
      </div>
    </section>
  );
}
