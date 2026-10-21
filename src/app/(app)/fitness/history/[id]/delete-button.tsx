"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteWorkout } from "../actions";

export function DeleteWorkoutButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Button
      variant="danger"
      size={confirm ? "lg" : "icon"}
      loading={pending}
      className={confirm ? "flex-1" : "size-12 rounded-2xl"}
      aria-label="Delete session"
      onClick={() => (confirm ? start(() => deleteWorkout(id)) : setConfirm(true))}
    >
      {confirm ? "Delete session" : <Trash2 className="size-[18px]" />}
    </Button>
  );
}
