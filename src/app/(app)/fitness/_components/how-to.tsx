import type { CatalogEntry } from "@/lib/exercise-catalog";

const LEVEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", expert: "Advanced" };

/** Targets and numbered steps for a library exercise. */
export function HowTo({ entry }: { entry: CatalogEntry }) {
  const facts = [
    { label: "Targets", value: entry.primary.join(", ") },
    { label: "Also works", value: entry.secondary.join(", ") },
    { label: "Level", value: LEVEL[entry.level] ?? entry.level },
  ].filter((f) => f.value);

  return (
    <>
      <dl className="card mt-4 divide-y divide-line">
        {facts.map((f) => (
          <div key={f.label} className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="shrink-0 text-[13px] text-ink-3">{f.label}</dt>
            <dd className="text-right text-[14.5px] text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>
      {entry.steps.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2.5 px-1 text-[15px] font-semibold tracking-tight text-ink">How to</h2>
          <ol className="card divide-y divide-line">
            {entry.steps.map((step, i) => (
              <li key={i} className="flex gap-3 px-4 py-3">
                <span className="tnum mt-px w-4 shrink-0 text-[13px] font-semibold text-ink-3">{i + 1}</span>
                <span className="text-[14.5px] leading-relaxed text-ink-2">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
