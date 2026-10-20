"use client";

import { Check, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/controls";
import { cn } from "@/lib/cn";
import { loadCatalogIndex, searchCatalog, type CatalogIndexEntry } from "@/lib/exercise-catalog";
import { MUSCLES } from "@/lib/fitness-math";
import { ExerciseThumb } from "./exercise-photo";

/** The library's search index, fetched once on first use. */
export function useCatalogIndex(enabled = true) {
  const [entries, setEntries] = useState<CatalogIndexEntry[] | null>(null);
  useEffect(() => {
    if (!enabled || entries) return;
    let live = true;
    loadCatalogIndex().then((e) => live && setEntries(e));
    return () => {
      live = false;
    };
  }, [enabled, entries]);
  return entries;
}

export const catalogSubtitle = (e: Pick<CatalogIndexEntry, "primary" | "equipment">) => [e.primary, e.equipment].filter(Boolean).join(" · ");

const PAGE = 40;

/** Rows of library exercises: links when `href` is given, buttons otherwise. Pages in 40 at a time. */
export function CatalogRows({
  entries,
  href,
  onPick,
  trailing,
  className,
}: {
  entries: CatalogIndexEntry[];
  href?: (e: CatalogIndexEntry) => string;
  onPick?: (e: CatalogIndexEntry) => void;
  trailing?: (e: CatalogIndexEntry) => ReactNode;
  className?: string;
}) {
  const [shown, setShown] = useState(PAGE);
  const rowClass = "tap flex min-h-16 w-full items-center gap-3 border-b border-line py-2.5 text-left last:border-0";
  return (
    <div className={cn("flex flex-col", className)}>
      {entries.slice(0, shown).map((e) => {
        const body = (
          <>
            <ExerciseThumb catalogId={e.images ? e.id : null} size={48} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] leading-snug font-medium text-ink">{e.name}</span>
              <span className="block truncate text-[12.5px] text-ink-3">{catalogSubtitle(e)}</span>
            </span>
            {trailing?.(e)}
          </>
        );
        return href ? (
          <Link key={e.id} href={href(e)} className={rowClass}>
            {body}
          </Link>
        ) : (
          <button key={e.id} type="button" onClick={() => onPick?.(e)} className={rowClass}>
            {body}
          </button>
        );
      })}
      {entries.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE * 2)}
          className="tap mt-3 h-11 rounded-2xl bg-sunken text-[14px] font-semibold text-ink-2"
        >
          Show more · {entries.length - shown} left
        </button>
      )}
    </div>
  );
}

export function MuscleChips({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={cn("no-scrollbar flex gap-1.5 overflow-x-auto", className)}>
      {[{ value: "all", label: "All" }, ...MUSCLES].map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onChange(m.value)}
          className={cn("tap h-8 shrink-0 rounded-full px-3 text-[13px] font-medium", value === m.value ? "bg-ink text-bg" : "bg-sunken text-ink-2")}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** The browse screen: search, muscle filter, every library exercise. `owned` marks ones already added. */
export function LibraryBrowser({ owned }: { owned: string[] }) {
  const entries = useCatalogIndex();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("all");
  const have = useMemo(() => new Set(owned), [owned]);
  const list = useMemo(() => (entries ? searchCatalog(entries, q, muscle) : []), [entries, q, muscle]);

  return (
    <div className="pb-8">
      <div className="sticky top-[calc(var(--safe-top)+3rem)] z-20 -mx-4 bg-bg px-4 pt-1 pb-3 sm:-mx-6 sm:px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, muscle or equipment" className="pl-10" />
        </div>
        <MuscleChips value={muscle} onChange={setMuscle} className="-mx-4 mt-3 px-4 sm:-mx-6 sm:px-6" />
      </div>
      {!entries ? (
        <div className="space-y-2 pt-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-sunken" />
          ))}
        </div>
      ) : list.length ? (
        <>
          <p className="tnum px-1 pt-1 pb-1 text-[12.5px] text-ink-3">
            {list.length} {list.length === 1 ? "exercise" : "exercises"}
          </p>
          <CatalogRows
            key={`${q}|${muscle}`}
            entries={list}
            href={(e) => `/fitness/exercises/library/${e.id}`}
            trailing={(e) => (have.has(e.id) ? <Check className="size-4 shrink-0 text-ok" aria-label="Added" strokeWidth={2.4} /> : null)}
          />
        </>
      ) : (
        <p className="py-12 text-center text-[14px] text-ink-3">Nothing matches “{q.trim()}”.</p>
      )}
    </div>
  );
}
