import Image, { type StaticImageData } from "next/image";
import askDark from "../../../public/landing/shots/ask-dark.webp";
import askLight from "../../../public/landing/shots/ask-light.webp";
import bodyDark from "../../../public/landing/shots/body-dark.webp";
import bodyLight from "../../../public/landing/shots/body-light.webp";
import focusDark from "../../../public/landing/shots/focus-dark.webp";
import focusLight from "../../../public/landing/shots/focus-light.webp";
import nowDark from "../../../public/landing/shots/now-dark.webp";
import nowLight from "../../../public/landing/shots/now-light.webp";
import seasonDark from "../../../public/landing/shots/season-dark.webp";
import seasonLight from "../../../public/landing/shots/season-light.webp";
import weekDark from "../../../public/landing/shots/week-dark.webp";
import weekLight from "../../../public/landing/shots/week-light.webp";
import { Cta } from "./cta";
import { DotField } from "./dot-field";
import { Reveal } from "./reveal";
import { Wordmark } from "./wordmark";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] font-medium text-accent">{children}</p>;
}

const h2 = "text-[32px] leading-[1.08] font-semibold tracking-[-0.03em] text-balance text-ink sm:text-[44px]";

const reasons = [
  { title: "Fewer goals", text: "Two or three at a time, for twelve weeks. Enough to matter, few enough to finish." },
  { title: "Hours, not hopes", text: "Each goal gets real time on your calendar, so you can see whether the week adds up." },
  { title: "One thing at a time", text: "When a block starts, start a session. Everything else waits its turn." },
];

export function WhyFocus() {
  return (
    <section id="why" className="mx-auto max-w-6xl px-6 pt-12 pb-20 sm:pt-24 sm:pb-32">
      <div className="grid gap-14 lg:grid-cols-[1.15fr_1fr] lg:gap-24">
        <Reveal>
          <Eyebrow>Why focus</Eyebrow>
          <h2 className={`mt-4 ${h2}`}>Busy is not the same as progress.</h2>
          <p className="mt-6 max-w-[32rem] text-[17px] leading-[1.6] text-pretty text-ink-2">
            Most days fill themselves. Messages, meetings and small tasks take the hours, and the work that matters waits for a free
            afternoon that never comes. Timeo gives that work a place in your week first.
          </p>
        </Reveal>
        <ul className="lg:pt-10">
          {reasons.map((r, i) => (
            <Reveal as="li" key={r.title} delay={i * 0.08} className="border-t border-line py-6 last:border-b">
              <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">{r.title}</h3>
              <p className="mt-1.5 text-[15.5px] leading-[1.55] text-ink-2">{r.text}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

type Shot = { light: StaticImageData; dark: StaticImageData };

/**
 * Focused crops of the app, light and dark, from /tmp/timeo-shot/landing-crops.mjs.
 * `align` places a crop in a wider panel: crops that run past their bottom edge sit on the panel's bottom.
 */
const moments: { tab: string; title: string; text: string; shot: Shot; alt: string; align: "center" | "end" }[] = [
  {
    tab: "Now",
    title: "Know what to do now.",
    text: "The block you are in, the time left, and one button to start.",
    shot: { light: nowLight, dark: nowDark },
    alt: "The Now screen: the block in progress, a large countdown of the time left and a bar from its start to its end.",
    align: "center",
  },
  {
    tab: "Focus",
    title: "A quiet timer.",
    text: "Full screen, one thing, and a thin line from start to end.",
    shot: { light: focusLight, dark: focusDark },
    alt: "A focus session: the task with its goal colour, a large timer and a progress line with the start and end times.",
    align: "center",
  },
  {
    tab: "Week",
    title: "Hours on the calendar.",
    text: "Every block belongs to a goal, and each day shows how full it is.",
    shot: { light: weekLight, dark: weekDark },
    alt: "The Week screen: seven days with how full each one is, the hours planned and free, and the day's time blocks.",
    align: "end",
  },
  {
    tab: "Season",
    title: "Twelve weeks, a few goals.",
    text: "See the hours each goal got this week, and review in five minutes.",
    shot: { light: seasonLight, dark: seasonDark },
    alt: "The Season screen: hours toward goals this week, the weekly review, and goals with progress and status.",
    align: "end",
  },
  {
    tab: "Ask",
    title: "Ask Timi, or add anything.",
    text: "Type or say it. Timi plans your day, books blocks and adds tasks.",
    shot: { light: askLight, dark: askDark },
    alt: "The Ask sheet: a box to type or say anything to Timi, suggestions, and quick actions to add a task, block, focus, meal or weigh-in.",
    align: "end",
  },
  {
    tab: "Body",
    title: "Training and food, close by.",
    text: "Routines, set logging, meals and weigh-ins next to your plan.",
    shot: { light: bodyLight, dark: bodyDark },
    alt: "Today's food: calories against the target, protein and water, and a button to log a meal.",
    align: "center",
  },
];

/** One crop per mode; CSS shows the one that matches the page (data-mode, else the system setting). */
function ShotPanel({ shot, alt, align }: { shot: Shot; alt: string; align: "center" | "end" }) {
  const img = "mx-auto h-auto w-full max-w-[390px]";
  return (
    <div className={`l-panel flex flex-1 justify-center ${align === "end" ? "items-end" : "items-center"}`}>
      <Image src={shot.light} alt={alt} unoptimized className={`${img} dark:hidden`} />
      <Image src={shot.dark} alt={alt} unoptimized className={`${img} hidden dark:block`} />
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-32">
      <Reveal className="mx-auto max-w-[40rem] px-2 text-center sm:px-0">
        <Eyebrow>Inside Timeo</Eyebrow>
        <h2 className={`mt-4 ${h2}`}>Everything for a focused season.</h2>
        <p className="mt-5 text-[17px] leading-[1.6] text-pretty text-ink-2">Built around twelve weeks, not an endless to-do list.</p>
      </Reveal>
      <ul className="mt-14 grid gap-x-6 gap-y-14 sm:mt-20 md:grid-cols-2 md:gap-y-16">
        {moments.map((m, i) => (
          <Reveal as="li" key={m.tab} delay={(i % 2) * 0.08} className="flex flex-col">
            <ShotPanel shot={m.shot} alt={m.alt} align={m.align} />
            <div className="mt-6 px-2 sm:px-1">
              <p className="text-[13px] font-medium text-accent">{m.tab}</p>
              <h3 className="mt-1.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">{m.title}</h3>
              <p className="mt-1.5 text-[15.5px] leading-[1.55] text-pretty text-ink-2">{m.text}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

const steps = [
  { title: "Set your season", text: "Pick two or three goals and how many hours a week each one gets." },
  { title: "Plan your week", text: "Place time blocks on the calendar, or ask Timi to draft the week with you." },
  { title: "Show up and focus", text: "Start a session when a block begins. Review at the end of the week and adjust." },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-16 sm:py-32">
      <Reveal className="max-w-[40rem]">
        <Eyebrow>How it works</Eyebrow>
        <h2 className={`mt-4 ${h2}`}>Three steps, then repeat.</h2>
      </Reveal>
      <ol className="mt-14 grid gap-10 sm:mt-20 sm:grid-cols-3 sm:gap-8">
        {steps.map((s, i) => (
          <Reveal as="li" key={s.title} delay={i * 0.08} className="border-t border-line pt-6">
            <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-[14px] font-semibold text-accent tabular-nums">
              {i + 1}
            </span>
            <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.02em] text-ink">{s.title}</h3>
            <p className="mt-2 max-w-[22rem] text-[15.5px] leading-[1.55] text-ink-2">{s.text}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="px-4 pt-8 pb-24 sm:px-6 sm:pb-32">
      <div className="relative mx-auto flex max-w-6xl items-center justify-center overflow-hidden rounded-3xl border border-line px-6 py-24 sm:py-32">
        <DotField variant="quiet" />
        <Reveal className="relative">
          <div data-dots-clear className="flex flex-col items-center text-center">
            <h2 className={h2}>Start your first season.</h2>
            <p className="mt-4 text-[17px] text-ink-2">Free, and set up in a few minutes.</p>
            <Cta variant="final" className="mt-9" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line pb-[var(--safe-bottom)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <Wordmark />
        <div className="flex items-center gap-6 text-[14px] text-ink-3">
          <a href="/login" className="hover:text-ink">
            Sign in
          </a>
          <a href="/signup" className="hover:text-ink">
            Create account
          </a>
          <span>Goal · Plan · System</span>
        </div>
      </div>
    </footer>
  );
}
