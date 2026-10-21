import { CalendarRange, Dumbbell, ListChecks, MessageCircle, Target, Timer, type LucideIcon } from "lucide-react";
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

const features: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Target, title: "Seasons and goals", text: "Twelve weeks, two or three goals, and the hours each one needs every week." },
  { icon: CalendarRange, title: "Time blocks", text: "Plan the week on a calendar. Every block belongs to a goal, so the time is easy to protect." },
  { icon: Timer, title: "Focus sessions", text: "A quiet full-screen timer for the block in front of you. Start, stay with it, mark it done." },
  { icon: ListChecks, title: "Weekly review", text: "Once a week, see what moved, what slipped and what the next week needs." },
  { icon: Dumbbell, title: "Training and food", text: "Routines, a weekly split, set logging, meals and weigh-ins, next to the rest of your plan." },
  { icon: MessageCircle, title: "Timi, your assistant", text: "Type or say what you need. Timi plans your day, books blocks and adds tasks for you." },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20 sm:py-32">
      <Reveal className="mx-auto max-w-[40rem] text-center">
        <Eyebrow>Features</Eyebrow>
        <h2 className={`mt-4 ${h2}`}>Everything for a focused season.</h2>
        <p className="mt-5 text-[17px] leading-[1.6] text-pretty text-ink-2">Built around twelve weeks, not an endless to-do list.</p>
      </Reveal>
      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:mt-20 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 0.06} className="bg-bg p-7 sm:p-8">
            <f.icon className="size-6 text-ink" strokeWidth={1.4} aria-hidden />
            <h3 className="mt-6 text-[17px] font-semibold tracking-[-0.015em] text-ink">{f.title}</h3>
            <p className="mt-2 text-[15.5px] leading-[1.55] text-ink-2">{f.text}</p>
          </Reveal>
        ))}
      </div>
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
    <section id="how" className="mx-auto max-w-6xl px-6 py-20 sm:py-32">
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
