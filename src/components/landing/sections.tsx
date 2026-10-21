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
import { Reveal } from "./reveal";
import { Timeline, TimelineStep } from "./timeline";
import { Wordmark } from "./wordmark";

const h2 = "text-[32px] leading-[1.08] font-semibold tracking-[-0.03em] text-balance text-ink sm:text-[44px]";

export function WhyFocus() {
  return (
    <section id="why" className="mx-auto max-w-6xl px-6 pt-12 pb-20 sm:pt-24 sm:pb-28">
      <Reveal className="max-w-[44rem]">
        <h2 className={h2}>Busy is not the same as progress.</h2>
        <p className="mt-6 text-[18px] leading-[1.6] text-pretty text-ink-2 sm:text-[20px]">
          Most days fill themselves. Messages, meetings and small tasks take the hours, and the work you care about waits for a free
          afternoon that never comes. Timeo books that work into your week first, then helps you show up for it.
        </p>
      </Reveal>
    </section>
  );
}

type Shot = { light: StaticImageData; dark: StaticImageData };

/**
 * One week, told in the app's own terms: a time, what happens, and the screen
 * you would see. Crops come from /tmp/timeo-shot/landing-crops.mjs.
 * `align` places a crop in its panel: crops that run past their bottom edge sit on the panel's bottom.
 */
const week: { day: string; time: string; text: string; shot: Shot; alt: string; align: "center" | "end" }[] = [
  {
    day: "Sunday",
    time: "19:00",
    text: "Give each goal its hours for the week. Every day shows how full it already is, so you know what fits before Monday.",
    shot: { light: weekLight, dark: weekDark },
    alt: "The Week screen: seven days with how full each one is, the hours planned and free, and the day's time blocks.",
    align: "end",
  },
  {
    day: "Monday",
    time: "09:00",
    text: "Open Timeo and it shows one thing: the block you are in and how long is left.",
    shot: { light: nowLight, dark: nowDark },
    alt: "The Now screen: the block in progress, a large countdown of the time left and a bar from its start to its end.",
    align: "center",
  },
  {
    day: "Monday",
    time: "09:01",
    text: "Start a session. The screen goes quiet: the task, a timer, and a line from start to end.",
    shot: { light: focusLight, dark: focusDark },
    alt: "A focus session: the task with its goal colour, a large timer and a progress line with the start and end times.",
    align: "center",
  },
  {
    day: "Tuesday",
    time: "12:40",
    text: "Something came up. Tell Timi, typed or spoken. It moves the block, adds the task and tells you what still fits.",
    shot: { light: askLight, dark: askDark },
    alt: "The Ask sheet: a box to type or say anything to Timi, suggestions, and quick actions to add a task, block, focus, meal or weigh-in.",
    align: "end",
  },
  {
    day: "Wednesday",
    time: "19:00",
    text: "Training and food live next to the plan. The gym gets a block like everything else, and meals are one tap.",
    shot: { light: bodyLight, dark: bodyDark },
    alt: "Today's food: calories against the target, protein and water, and a button to log a meal.",
    align: "center",
  },
  {
    day: "Friday",
    time: "17:30",
    text: "See the hours each goal actually got, then review the week in five minutes and adjust the next one.",
    shot: { light: seasonLight, dark: seasonDark },
    alt: "The Season screen: hours toward goals this week, the weekly review, and goals with progress and status.",
    align: "end",
  },
];

/** One crop per mode; CSS shows the one that matches the page (data-mode, else the system setting). */
function ShotPanel({ shot, alt, align }: { shot: Shot; alt: string; align: "center" | "end" }) {
  const img = "mx-auto h-auto w-full max-w-[390px]";
  return (
    <div className={`l-panel flex justify-center ${align === "end" ? "items-end" : "items-center"}`}>
      <Image src={shot.light} alt={alt} unoptimized className={`${img} dark:hidden`} />
      <Image src={shot.dark} alt={alt} unoptimized className={`${img} hidden dark:block`} />
    </div>
  );
}

export function Week() {
  return (
    <section id="week" className="mx-auto max-w-6xl px-6 pb-16 sm:pb-28">
      <Reveal className="max-w-[44rem]">
        <h2 className={h2}>A week with Timeo.</h2>
      </Reveal>
      <Timeline>
        {week.map((m) => (
          <TimelineStep
            key={m.day + m.time}
            when={
              <p className="flex items-baseline gap-2 md:flex-col md:gap-1">
                <span className="text-[15px] font-medium text-ink">{m.day}</span>
                <span className="font-mono text-[15px] text-ink-3 tabular-nums">{m.time}</span>
              </p>
            }
            text={<p className="max-w-[30rem] text-[17px] leading-[1.6] text-pretty text-ink-2 md:text-[18px]">{m.text}</p>}
            panel={<ShotPanel shot={m.shot} alt={m.alt} align={m.align} />}
          />
        ))}
      </Timeline>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24 sm:pb-32">
      <Reveal className="border-t border-line pt-12 sm:pt-16">
        <h2 className={h2}>Start your first season.</h2>
        <p className="mt-4 max-w-[32rem] text-[17px] leading-[1.6] text-ink-2">
          Pick a goal or two and the hours they need. It is free and takes a few minutes.
        </p>
        <Cta variant="final" className="mt-8" />
      </Reveal>
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
        </div>
      </div>
    </footer>
  );
}
