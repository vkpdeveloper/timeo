"use client";

import { HotkeysProvider, useHotkey } from "@tanstack/react-hotkeys";
import { AnimatePresence, motion, useDragControls, useIsPresent, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useIsClient, useMediaQuery } from "@/lib/hooks";
import { springs } from "./motion";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Sticky footer, typically the primary action */
  footer?: ReactNode;
  className?: string;
  /** Full height sheet (e.g. pickers with long lists) */
  tall?: boolean;
  /** Desktop: pin near the top so the dialog grows downward as its content changes (command menus) */
  top?: boolean;
};

/**
 * iOS-style bottom sheet on phones, centred dialog on larger screens.
 * Drag the handle (or the header) down to dismiss.
 */
export function Sheet({ open, onClose, title, description, children, footer, className, tall, top }: SheetProps) {
  const controls = useDragControls();
  const titleId = useId();
  const mounted = useIsClient();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  // Backdrop fades as the sheet is dragged down
  const dragY = useMotionValue(0);
  const backdrop = useTransform(() => {
    const v: unknown = dragY.get();
    return typeof v === "number" && v > 0 ? Math.max(0.25, 1 - v / 520) : 1;
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 500) onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cn("fixed inset-0 z-[60] flex items-end justify-center", top ? "md:items-start md:pt-[10dvh]" : "md:items-center")}>
          <SheetScope id={titleId} onClose={onClose}>
            <motion.div className="absolute inset-0" style={{ opacity: backdrop }}>
              <motion.div
                className="absolute inset-0 bg-black/30 dark:bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                onClick={onClose}
              />
            </motion.div>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              className={cn(
                "relative flex w-full flex-col overflow-hidden bg-surface shadow-float",
                "rounded-t-[20px] border-t border-line md:max-w-lg md:rounded-[20px] md:border",
                tall ? "h-[92dvh] md:h-[80dvh]" : top ? "max-h-[92dvh] md:max-h-[80dvh]" : "max-h-[92dvh] md:max-h-[85dvh]",
                className,
              )}
              initial={isDesktop ? { opacity: 0, scale: 0.96, y: 8 } : { y: "100%" }}
              animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
              exit={isDesktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: "100%" }}
              transition={springs.sheet}
              style={isDesktop ? undefined : { y: dragY }}
              drag={isDesktop ? false : "y"}
              dragControls={controls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={onDragEnd}
            >
              <div
                className="shrink-0 touch-none cursor-grab px-5 pt-2.5 active:cursor-grabbing"
                onPointerDown={(e) => controls.start(e)}
              >
                <div className="mx-auto mb-2.5 h-[5px] w-9 rounded-full bg-line-strong md:hidden" />
                {(title || description) && (
                  <div className="flex items-start justify-between gap-4 pb-3 md:pt-3">
                    <div className="min-w-0">
                      {title && (
                        <h2 id={titleId} className="text-[18px] leading-tight font-semibold tracking-[-0.015em] text-ink">
                          {title}
                        </h2>
                      )}
                      {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="tap relative -mt-0.5 -mr-1 grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-ink-2 before:absolute before:-inset-1.5 before:content-[''] hover:text-ink"
                      aria-label="Close"
                    >
                      <X className="size-4" strokeWidth={2.2} />
                    </button>
                  </div>
                )}
              </div>
              <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
              {footer && (
                <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[max(14px,var(--safe-bottom))]">
                  {footer}
                </div>
              )}
              {!footer && <div className="h-[var(--safe-bottom)] shrink-0" />}
            </motion.div>
          </SheetScope>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * The sheet's own hotkey scope: page shortcuts pause while it is open, and
 * come back as soon as it starts closing (not after the exit animation).
 */
function SheetScope({ id, onClose, children }: { id: string; onClose: () => void; children: ReactNode }) {
  const present = useIsPresent();
  return (
    <HotkeysProvider scope={`sheet${id}`} exclusive enabled={present}>
      <SheetKeys onClose={onClose} />
      {children}
    </HotkeysProvider>
  );
}

/** Escape closes the sheet. Inside its scope, so it still works while page shortcuts pause. */
function SheetKeys({ onClose }: { onClose: () => void }) {
  useHotkey("Escape", onClose);
  return null;
}
