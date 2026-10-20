"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorNote } from "../../../_components/day-actions";
import { addFromCatalog } from "../../actions";

export function AddFromLibrary({ catalogId, mineId }: { catalogId: string; mineId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (mineId)
    return (
      <ButtonLink href={`/fitness/exercises/${mineId}`} variant="secondary" size="lg" className="mt-4">
        In your exercises · Open
      </ButtonLink>
    );
  return (
    <div className="mt-4">
      <ErrorNote error={error} />
      <Button
        size="lg"
        loading={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              const ex = await addFromCatalog(catalogId);
              router.push(`/fitness/exercises/${ex.id}`);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not add it");
            }
          })
        }
      >
        Add to my exercises
      </Button>
    </div>
  );
}
