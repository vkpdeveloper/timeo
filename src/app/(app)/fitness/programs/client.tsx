"use client";

import { Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, SubmitButton } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { colorVar, softVar } from "@/lib/colors";
import { WEEKDAY_LETTER } from "@/lib/dates";
import { ErrorNote } from "../_components/day-actions";
import { deleteProgram, loadProgram, renameProgram, saveCurrentProgram } from "./actions";

export type ProgramView = {
  kind: "preset" | "saved";
  id: string;
  name: string;
  description: string | null;
  meta: string;
  current: boolean;
  days: { name: string; color: string | null }[];
  routines: { name: string; focus: string; color: string; exercises: string[] }[];
};

export function ProgramCard({ program: p }: { program: ProgramView }) {
  const [expanded, setExpanded] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="card overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold tracking-tight text-ink">{p.name}</h3>
            <p className="mt-0.5 text-[12.5px] font-medium text-ink-3">{p.meta}</p>
          </div>
          {p.current ? (
            <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-ok-soft px-2.5 text-[11.5px] font-semibold text-ok">
              <Check className="size-3" strokeWidth={3} /> Current
            </span>
          ) : p.kind === "saved" ? (
            <button
              type="button"
              onClick={() => setEdit(true)}
              aria-label="Rename program"
              className="tap -mt-1.5 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-ink-3"
            >
              <Pencil className="size-4" />
            </button>
          ) : null}
        </div>
        {p.description && <p className="mt-2 text-[13.5px] leading-snug text-ink-2">{p.description}</p>}

        <div className="mt-3.5 grid grid-cols-7 gap-1">
          {p.days.map((d, i) => (
            <div key={i} className="flex min-w-0 flex-col items-center gap-1">
              <span className="text-[10.5px] font-semibold text-ink-3">{WEEKDAY_LETTER[i]}</span>
              <span
                className="flex h-9 w-full items-center justify-center rounded-lg px-0.5 text-center text-[9.5px] leading-[1.1] font-semibold"
                style={
                  d.color
                    ? { background: softVar(d.color), color: colorVar(d.color) }
                    : { background: "var(--sunken)", color: "var(--ink-3)" }
                }
                title={d.name}
              >
                <span className="line-clamp-2 break-words">{d.color ? d.name : "Rest"}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-line px-4 py-3">
          {p.routines.map((r) => (
            <div key={r.name} className="py-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: colorVar(r.color) }} />
                <span className="text-[14.5px] font-semibold text-ink">{r.name}</span>
                {r.focus && <span className="truncate text-[12.5px] text-ink-3">{r.focus}</span>}
              </div>
              <ul className="tnum mt-1 pl-4 text-[13px] leading-relaxed text-ink-2">
                {r.exercises.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="flex border-t border-line">
        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          className="tap flex h-12 flex-1 items-center justify-center gap-1 text-[13.5px] font-semibold text-ink-2"
        >
          {expanded ? "Hide routines" : `${p.routines.length} routines`}
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
        </button>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="tap flex h-12 flex-1 items-center justify-center border-l border-line text-[13.5px] font-semibold text-accent"
        >
          {p.current ? "Reload" : "Use this program"}
        </button>
      </div>

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Use ${p.name}?`}
        description="Replaces your weekly schedule. Your logs and history stay."
        footer={
          <Button
            size="lg"
            loading={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                try {
                  await loadProgram(p.kind, p.id);
                  setConfirm(false);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not load the program");
                }
              })
            }
          >
            Use this program
          </Button>
        }
      >
        <ul className="flex flex-col gap-2 text-[14px] leading-relaxed text-ink-2">
          <li>Routines with the same name are updated; new ones are added.</li>
          <li>Routines not in this program are archived, not deleted.</li>
          <li>Program notes are replaced.</li>
        </ul>
        <div className="mt-4">
          <ErrorNote error={error} />
        </div>
      </Sheet>

      {p.kind === "saved" && (
        <Sheet open={edit} onClose={() => setEdit(false)} title="Program">
          <form
            action={async (fd) => {
              setError(null);
              try {
                await renameProgram(fd);
                setEdit(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Something went wrong");
              }
            }}
          >
            <input type="hidden" name="id" value={p.id} />
            <Field label="Name">
              <Input name="name" defaultValue={p.name} required />
            </Field>
            <Field label="Description" hint="optional">
              <Textarea name="description" rows={2} defaultValue={p.description ?? ""} />
            </Field>
            <ErrorNote error={error} />
            <div className="flex gap-2.5">
              <Button
                type="button"
                variant="danger"
                size={confirmDelete ? "lg" : "icon"}
                className={confirmDelete ? "flex-1" : "size-[52px] rounded-2xl"}
                loading={deleting}
                aria-label="Delete program"
                onClick={() =>
                  confirmDelete
                    ? startDelete(async () => {
                        await deleteProgram(p.id);
                        setEdit(false);
                      })
                    : setConfirmDelete(true)
                }
              >
                {confirmDelete ? "Delete program" : <Trash2 className="size-[18px]" />}
              </Button>
              {!confirmDelete && (
                <SubmitButton size="lg" className="flex-1">
                  Save
                </SubmitButton>
              )}
            </div>
          </form>
        </Sheet>
      )}
    </div>
  );
}

export function SaveCurrentButton({ suggestedName }: { suggestedName: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button variant="secondary" size="lg" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Save current as program
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Save current program"
        description="Your routines, weekly split and program notes, as they are now."
      >
        <form
          action={async (fd) => {
            setError(null);
            try {
              await saveCurrentProgram(fd);
              setOpen(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong");
            }
          }}
        >
          <Field label="Name">
            <Input name="name" defaultValue={suggestedName} placeholder="e.g. Autumn PPL" required autoFocus />
          </Field>
          <Field label="Description" hint="optional">
            <Textarea name="description" rows={2} placeholder="What it is for" />
          </Field>
          <ErrorNote error={error} />
          <SubmitButton size="lg">Save program</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
