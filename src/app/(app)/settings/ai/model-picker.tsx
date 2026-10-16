"use client";

import { Check, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { saveAiSettings } from "@/actions/ai";
import { PillPicker } from "@/components/ui/controls";
import { EFFORT_LABEL, type CatalogModel, type Effort } from "@/lib/ai/shared";
import { cn } from "@/lib/cn";

const ctx = (n: number | null) => (n == null ? null : n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M` : `${Math.round(n / 1000)}K`);
const price = (m: CatalogModel) =>
  m.free ? "Free" : m.inputCost != null && m.outputCost != null ? `$${m.inputCost} / $${m.outputCost}` : null;

export function ModelPicker({
  models,
  initialModel,
  initialEffort,
  hasKey,
}: {
  models: CatalogModel[];
  initialModel: string;
  initialEffort: string;
  hasKey: boolean;
}) {
  const [modelId, setModelId] = useState(initialModel);
  const [effort, setEffort] = useState<Effort>(initialEffort as Effort);
  const [query, setQuery] = useState("");
  const [showZen, setShowZen] = useState(false);
  const [saving, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const current = models.find((m) => m.id === modelId);
  const efforts = current?.efforts ?? ["auto"];

  const save = (id: string, e: Effort) => {
    setSaved(false);
    start(async () => {
      await saveAiSettings(id, e);
      setSaved(true);
    });
  };

  const pick = (m: CatalogModel) => {
    const nextEffort = m.efforts.includes(effort) ? effort : m.efforts.includes("low") ? "low" : "auto";
    setModelId(m.id);
    setEffort(nextEffort);
    save(m.id, nextEffort);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models.filter((m) => !q || m.name.toLowerCase().includes(q) || m.id.includes(q));
  }, [models, query]);
  const go = filtered.filter((m) => m.tier === "go");
  const zen = filtered.filter((m) => m.tier === "zen");

  return (
    <div className="mt-8">
      {!hasKey && (
        <p className="mb-4 rounded-2xl bg-warn-soft px-4 py-3 text-[13.5px] font-medium text-warn">
          Add OPENCODE_API_KEY to the server environment to enable AI.
        </p>
      )}

      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">Model</div>
            <div className="mt-1 truncate text-[17px] font-semibold tracking-tight text-ink">{current?.name ?? modelId}</div>
          </div>
          <span className={cn("shrink-0 text-[12px] font-medium", saving ? "text-ink-3" : saved ? "text-ok" : "text-transparent")}>
            {saving ? "Saving…" : "Saved"}
          </span>
        </div>
        <div className="mt-4">
          <div className="eyebrow mb-2">Reasoning effort</div>
          {efforts.length > 1 ? (
            <PillPicker
              value={effort}
              onChange={(e) => {
                setEffort(e);
                save(modelId, e);
              }}
              options={efforts.map((e) => ({ value: e, label: EFFORT_LABEL[e] }))}
            />
          ) : (
            <p className="text-[13.5px] text-ink-3">This model doesn&apos;t expose reasoning control.</p>
          )}
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-3">
            Low is plenty for logging. Higher effort is slower and uses more of your Go limit.
          </p>
        </div>
      </div>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models"
          className="field pl-10"
          aria-label="Search models"
        />
      </div>

      <ModelGroup title="Included in OpenCode Go" models={go} selected={modelId} onPick={pick} />

      {zen.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowZen((s) => !s)}
            className="tap w-full rounded-2xl border border-dashed border-line-strong px-4 py-3 text-left text-[13.5px] font-medium text-ink-2"
          >
            {showZen ? "Hide" : "Show"} {zen.length} pay-as-you-go models
            <span className="block text-[12px] font-normal text-ink-3">Not in Go. They use OpenCode credits.</span>
          </button>
          {showZen && <ModelGroup title="Pay-as-you-go" models={zen} selected={modelId} onPick={pick} />}
        </div>
      )}
    </div>
  );
}

function ModelGroup({
  title,
  models,
  selected,
  onPick,
}: {
  title: string;
  models: CatalogModel[];
  selected: string;
  onPick: (m: CatalogModel) => void;
}) {
  if (!models.length) return null;
  return (
    <section className="mt-6">
      <div className="eyebrow mb-2 px-1">{title}</div>
      <div className="card overflow-hidden">
        {models.map((m) => {
          const active = m.id === selected;
          const meta = [m.efforts.length > 1 ? "Reasoning" : null, ctx(m.context) && `${ctx(m.context)} context`, price(m)]
            .filter(Boolean)
            .join(" · ");
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m)}
              className="tap flex w-full items-center gap-3 px-4 py-3 text-left [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line active:bg-sunken"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-medium text-ink">{m.name}</span>
                  {m.free && <span className="rounded-full bg-ok-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-ok">FREE</span>}
                  {!m.toolCall && <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-warn">no tools</span>}
                </div>
                {meta && <div className="mt-0.5 truncate text-[12.5px] text-ink-3">{meta}</div>}
              </div>
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border-[1.75px]",
                  active ? "border-accent bg-accent text-accent-ink" : "border-line-strong",
                )}
              >
                {active && <Check className="size-3.5" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-[11.5px] text-ink-3">Prices per 1M tokens, input / output. Live list from OpenCode and models.dev.</p>
    </section>
  );
}
