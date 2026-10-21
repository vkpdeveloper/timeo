import { SubHeader } from "@/components/ui/primitives";
import { Importer } from "./importer";

export default function ImportPage() {
  return (
    <>
      <SubHeader back="/app/fitness" backLabel="Body" />
      <div className="pb-2">
        <header className="pt-5 pb-4 lg:pt-10 lg:pb-5">
          <h1 className="display text-[26px] lg:text-[28px] text-ink">Import training</h1>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
            Paste a program and log as JSON. Routines, your weekly split, program notes and logged days are added or
            updated. Importing the same days again updates them instead of duplicating.
          </p>
        </header>
        <Importer />
      </div>
    </>
  );
}
