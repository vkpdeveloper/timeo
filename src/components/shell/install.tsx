"use client";

import { Check, Download, Share, SquarePlus, X } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useClientValue } from "@/lib/hooks";
import { useInstall } from "@/lib/pwa";

/** Settings row: install button where supported, steps on iPhone, or "Installed". */
export function InstallRow() {
  const { canPrompt, installed, ios, install } = useInstall();
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
        {installed ? <Check className="size-[18px]" /> : <Download className="size-[18px]" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium text-ink">{installed ? "Installed" : "Install Timeo"}</div>
        <div className="text-[12.5px] leading-relaxed text-ink-3">
          {installed ? (
            "Running as an app."
          ) : canPrompt ? (
            "Opens in its own window, works offline."
          ) : ios ? (
            <span className="inline-flex flex-wrap items-center gap-1">
              Tap <Share className="size-3.5 text-accent" /> then <SquarePlus className="size-3.5 text-accent" /> Add to Home Screen
            </span>
          ) : (
            "Use your browser menu: Install app / Add to Home screen."
          )}
        </div>
      </div>
      {canPrompt && !installed && (
        <Button
          size="sm"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await install().finally(() => setBusy(false));
          }}
        >
          Install
        </Button>
      )}
    </div>
  );
}

const DISMISS_KEY = "timeo.install.dismissed";

/** A quiet one-time banner on Today when the app can be installed. */
export function InstallBanner() {
  const { canPrompt, installed, ios, install } = useInstall();
  // hidden for two weeks after a dismiss; hidden during SSR
  const recentlyDismissed = useClientValue(() => {
    try {
      return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < 14 * 86_400_000;
    } catch {
      return false;
    }
  }, true);
  const [hidden, setHidden] = useState(false);
  if (hidden || installed || recentlyDismissed || (!canPrompt && !ios)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setHidden(true);
  };

  return (
    <div className="card fade-up mt-5 flex items-center gap-3 p-3.5 pl-4">
      <Image src="/icon-192.png" alt="" width={40} height={40} className="size-10 shrink-0 rounded-[11px]" />
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-semibold text-ink">Get the app</div>
        <div className="text-[12.5px] text-ink-3">
          {canPrompt ? "Full screen, offline and reminders." : "Share → Add to Home Screen for reminders."}
        </div>
      </div>
      {canPrompt && (
        <Button size="sm" onClick={() => install().then((ok) => ok && setHidden(true))}>
          Install
        </Button>
      )}
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="tap grid size-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-sunken">
        <X className="size-4" />
      </button>
    </div>
  );
}
