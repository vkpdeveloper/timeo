"use client";

import { Check, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { setBlockDone } from "@/actions/blocks";
import { AskTimi } from "@/components/ui/ask-timi";
import { Button, ButtonLink } from "@/components/ui/button";
import { Countdown, LinearProgress } from "@/components/ui/live";
import { GUIDE } from "@/lib/ai/guide";
import { formatDuration, toTimeInput } from "@/lib/dates";

/** What the hero needs about a block, already resolved on the server. */
export type HeroBlock = {
  id: string;
  title: string;
  kind: "focus" | "meeting" | "workout" | "meal" | "life" | "admin";
  startMin: number;
  endMin: number;
  /** Unix ms, in the user's timezone. */
  startAt: number;
  endAt: number;
  /** Goal title, or the kind's name. */
  context: string;
  /** CSS colour for the dot and bar. */
  color: string;
};

export type HeroView =
  | { kind: "now"; block: HeroBlock }
  | { kind: "next"; block: HeroBlock }
  | { kind: "free"; until: number; freeMin: number; next: { title: string; color: string } | null; empty: boolean }
  | {
      kind: "done";
      line: string;
      tomorrow: { title: string; startMin: number; color: string } | null;
    };

/** The one thing: what to do right now. No card, lots of air. */
export function NowHero({ view, serverNow, refreshAt }: { view: HeroView; serverNow: number; refreshAt: number | null }) {
  useRefreshAt(refreshAt);
  return <div className="page-enter pt-12 pb-2 lg:pt-16">{body(view, serverNow)}</div>;
}

function body(view: HeroView, serverNow: number) {
  switch (view.kind) {
    case "now":
      return <Running block={view.block} serverNow={serverNow} />;
    case "next":
      return <Next block={view.block} serverNow={serverNow} />;
    case "free":
      return <Free view={view} />;
    case "done":
      return <DayDone view={view} />;
  }
}

/** Reload the page's data when the hero should change (a block ends or starts). */
function useRefreshAt(at: number | null) {
  const router = useRouter();
  useEffect(() => {
    if (at == null) return;
    const wait = at - Date.now() + 1500;
    if (wait > 6 * 3600_000) return;
    const id = setTimeout(() => router.refresh(), Math.max(1000, wait));
    return () => clearTimeout(id);
  }, [at, router]);
}

function Eyebrow({ color, children }: { color?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-[14px] font-medium text-ink-2">
      {color && <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="truncate">{children}</span>
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="display mt-2.5 text-[28px] text-balance text-ink lg:text-[32px]">{children}</h1>;
}

const focusable = (k: HeroBlock["kind"]) => k === "focus" || k === "admin";

function Running({ block: b, serverNow }: { block: HeroBlock; serverNow: number }) {
  return (
    <>
      <Eyebrow color={b.color}>{b.context}</Eyebrow>
      <Title>{b.title}</Title>
      <div className="mt-9 flex items-baseline gap-3">
        <Countdown to={b.endAt} now={serverNow} className="text-[76px] tracking-[-0.04em] text-ink lg:text-[92px]" />
        <span className="text-[17px] text-ink-3">left</span>
      </div>
      <LinearProgress
        className="mt-7"
        startAt={b.startAt}
        endAt={b.endAt}
        now={serverNow}
        color={b.color}
        start={toTimeInput(b.startMin)}
        end={toTimeInput(b.endMin % 1440)}
      />
      <div className="mt-9">
        <BlockAction block={b} early={false} />
      </div>
    </>
  );
}

function Next({ block: b, serverNow }: { block: HeroBlock; serverNow: number }) {
  return (
    <>
      <Eyebrow color={b.color}>
        Next at <span className="mono">{toTimeInput(b.startMin)}</span>
      </Eyebrow>
      <Title>{b.title}</Title>
      <div className="mt-9 flex items-baseline gap-3">
        <Countdown to={b.startAt} now={serverNow} className="text-[76px] tracking-[-0.04em] text-ink lg:text-[92px]" />
        <span className="text-[17px] text-ink-3">to start</span>
      </div>
      <p className="tnum mt-4 text-[14.5px] text-ink-3">
        <span className="mono">
          {toTimeInput(b.startMin)} → {toTimeInput(b.endMin % 1440)}
        </span>
        <span className="ml-2">{formatDuration(b.endMin - b.startMin)}</span>
      </p>
      {focusable(b.kind) || b.kind === "workout" ? (
        <div className="mt-9">
          <BlockAction block={b} early />
        </div>
      ) : null}
    </>
  );
}

/** The one primary button for a block: focus, workout, or mark it done. */
function BlockAction({ block: b, early }: { block: HeroBlock; early: boolean }) {
  const [pending, start] = useTransition();
  const cls = "lg:w-auto lg:px-8";
  if (focusable(b.kind))
    return (
      <ButtonLink href={`/app/focus?block=${b.id}`} variant="accent" size="lg" className={cls}>
        <Play className="size-4 fill-current" /> {early ? "Start early" : "Start focus"}
      </ButtonLink>
    );
  if (b.kind === "workout")
    return (
      <ButtonLink href="/app/fitness" variant="accent" size="lg" className={cls}>
        <Play className="size-4 fill-current" /> Start workout
      </ButtonLink>
    );
  return (
    <Button
      variant="accent"
      size="lg"
      className={cls}
      loading={pending}
      onClick={() => start(() => setBlockDone(b.id, true))}
    >
      <Check className="size-4" strokeWidth={2.6} /> Mark done
    </Button>
  );
}

function Free({ view }: { view: Extract<HeroView, { kind: "free" }> }) {
  return (
    <>
      <Eyebrow>
        Free until <span className="mono">{toTimeInput(view.until % 1440)}</span>
      </Eyebrow>
      <div className="display tnum mt-4 text-[76px] leading-none tracking-[-0.04em] text-ink lg:text-[92px]">
        {formatDuration(view.freeMin)}
      </div>
      <p className="mt-5 flex min-w-0 items-center gap-2 text-[15px] text-ink-2">
        {view.next ? (
          <>
            <span className="text-ink-3">Then</span>
            <span className="size-2 shrink-0 rounded-full" style={{ background: view.next.color }} />
            <span className="truncate">{view.next.title}</span>
          </>
        ) : view.empty ? (
          "Nothing planned yet. Give one goal a slot."
        ) : (
          "Nothing else planned today."
        )}
      </p>
      <div className="mt-8">
        <AskTimi prompt={GUIDE.planToday} label="Plan with Timi" />
      </div>
    </>
  );
}

function DayDone({ view }: { view: Extract<HeroView, { kind: "done" }> }) {
  return (
    <>
      <Eyebrow>Tonight</Eyebrow>
      <h1 className="display mt-2.5 text-[44px] text-ink lg:text-[52px]">Day done</h1>
      {view.line && <p className="tnum mt-3 text-[15px] text-ink-2">{view.line}</p>}
      <p className="mt-8 flex min-w-0 items-center gap-2 text-[15px] text-ink-2">
        <span className="text-ink-3">Tomorrow</span>
        {view.tomorrow ? (
          <>
            <span className="mono shrink-0 text-ink-3">{toTimeInput(view.tomorrow.startMin)}</span>
            <span className="size-2 shrink-0 rounded-full" style={{ background: view.tomorrow.color }} />
            <span className="truncate">{view.tomorrow.title}</span>
          </>
        ) : (
          <span>nothing planned yet</span>
        )}
      </p>
    </>
  );
}
