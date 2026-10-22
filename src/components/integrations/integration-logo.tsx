import { catalogEntry } from "@/lib/integrations/catalog";
import { cn } from "@/lib/cn";

/**
 * An app's own logo, from public/integrations. Logos that are tiles already (Todoist, Trello)
 * fill the frame; marks sit on a white tile, so dark marks (GitHub, Notion) read in dark mode too.
 */
export function IntegrationLogo({ id, size = 32, className }: { id: string; size?: number; className?: string }) {
  const tile = catalogEntry(id)?.logo === "icon";
  const inner = tile ? size : Math.round(size * 0.64);
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center overflow-hidden bg-white", className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.24) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs, no optimiser needed */}
      <img src={`/integrations/${id}.svg`} alt="" width={inner} height={inner} draggable={false} />
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-black/8 ring-inset" />
    </span>
  );
}
