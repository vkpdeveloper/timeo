"use client";

import { ChevronLeft, ImageIcon, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { searchCatalog, type CatalogIndexEntry } from "@/lib/exercise-catalog";
import { CatalogRows, catalogSubtitle, MuscleChips, useCatalogIndex } from "../../_components/catalog-list";
import { ErrorNote } from "../../_components/day-actions";
import { ExerciseFrames } from "../../_components/exercise-photo";
import { linkCatalog } from "../actions";

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

/** Library entries whose names share the most words with `name`. */
function suggestions(entries: CatalogIndexEntry[], name: string) {
  const mine = words(name).map((w) => w.replace(/s$/, ""));
  return entries
    .map((e) => ({ e, score: mine.filter((w) => e.name.toLowerCase().includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.name.length - b.e.name.length)
    .slice(0, 30)
    .map((x) => x.e);
}

/** Matches one of your exercises to a library entry for photos and steps; history stays with it. */
export function LinkLibrary({ exerciseId, name, linked }: { exerciseId: string; name: string; linked: { id: string; name: string } | null }) {
  const [open, setOpen] = useState(false);
  const entries = useCatalogIndex(open);
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("all");
  const [picked, setPicked] = useState<CatalogIndexEntry | null>(null);
  const [rename, setRename] = useState(true);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => {
    if (!entries) return [];
    if (!q.trim() && muscle === "all") return suggestions(entries, name);
    return searchCatalog(entries, q, muscle);
  }, [entries, q, muscle, name]);

  const close = () => {
    setOpen(false);
    setPicked(null);
    setQ("");
    setError(null);
  };
  const save = (catalogId: string | null) =>
    start(async () => {
      setError(null);
      try {
        await linkCatalog(exerciseId, catalogId, rename && catalogId != null);
        close();
      } catch (e) {
        setError(e instanceof Error ? e.message : "That didn't save. Try again.");
      }
    });

  return (
    <>
      {linked ? (
        <button type="button" onClick={() => setOpen(true)} className="tap mt-2.5 flex w-full items-center justify-between gap-3 px-1 text-left">
          <span className="min-w-0 truncate text-[13px] text-ink-3">Photos from the library · {linked.name}</span>
          <span className="shrink-0 text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4">Change</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap flex min-h-16 w-full items-center gap-3 rounded-[16px] border border-dashed border-line-strong px-4 py-3 text-left"
        >
          <ImageIcon className="size-5 shrink-0 text-ink-3" strokeWidth={1.8} />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-ink">Add photos and steps</span>
            <span className="block text-[12.5px] text-ink-3">Match it to a library exercise. Your history stays.</span>
          </span>
        </button>
      )}

      <Sheet open={open} onClose={close} title={picked ? "Use this one?" : "Match to library"} tall>
        {picked ? (
          <div>
            <button type="button" onClick={() => setPicked(null)} className="tap mb-3 -ml-1 inline-flex items-center gap-0.5 text-[14px] font-medium text-ink-2">
              <ChevronLeft className="size-4" /> Library
            </button>
            <ExerciseFrames catalogId={picked.id} name={picked.name} images={picked.images} />
            <div className="mt-3 px-1">
              <div className="text-[17px] font-semibold tracking-tight text-ink">{picked.name}</div>
              <div className="text-[13px] text-ink-3">{catalogSubtitle(picked)}</div>
            </div>
            {picked.name.toLowerCase() !== name.toLowerCase() && (
              <label className="mt-4 flex min-h-12 items-center justify-between gap-3 rounded-[12px] bg-surface-2 px-4 py-2 text-[15px] text-ink">
                <span>
                  Rename to “{picked.name}”
                  <span className="block text-[12.5px] text-ink-3">Off keeps “{name}”</span>
                </span>
                <input type="checkbox" checked={rename} onChange={(e) => setRename(e.target.checked)} className="size-5 shrink-0 accent-[var(--accent)]" />
              </label>
            )}
            <div className="mt-5">
              <ErrorNote error={error} />
              <Button size="lg" loading={pending} onClick={() => save(picked.id)}>
                Use this exercise
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library" className="pl-10" />
              </div>
              <MuscleChips value={muscle} onChange={setMuscle} className="-mx-5 mt-3 px-5" />
            </div>
            {!q.trim() && muscle === "all" && list.length > 0 && <p className="px-1 pb-1 text-[12.5px] text-ink-3">Closest to “{name}”</p>}
            {entries && <CatalogRows key={`${q}|${muscle}`} entries={list} onPick={setPicked} />}
            {entries && !list.length && <p className="py-10 text-center text-[14px] text-ink-3">Nothing matches. Try another word.</p>}
            {linked && (
              <div className="mt-4">
                <ErrorNote error={error} />
                <Button variant="ghost" size="lg" loading={pending} onClick={() => save(null)}>
                  Remove photos
                </Button>
              </div>
            )}
          </>
        )}
      </Sheet>
    </>
  );
}
