"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useIsClient, useMediaQuery } from "@/lib/hooks";

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
};

/**
 * iOS-style bottom sheet on phones, centred dialog on larger screens.
 * Drag the handle (or the header) down to dismiss.
 */
export function Sheet({ open, onClose, title, description, children, footer, className, tall }: SheetProps) {
  const controls = useDragControls();
  const titleId = useId();
  const mounted = useIsClient();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center">
          <motion.div
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px] dark:bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className={cn(
              "relative flex w-full flex-col overflow-hidden bg-surface shadow-float",
              "rounded-t-[28px] md:max-w-lg md:rounded-[28px]",
              tall ? "h-[92dvh] md:h-[80dvh]" : "max-h-[92dvh] md:max-h-[85dvh]",
              className,
            )}
            initial={isDesktop ? { opacity: 0, scale: 0.96, y: 8 } : { y: "100%" }}
            animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 380, mass: 0.9 }}
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
              <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-line-strong md:hidden" />
              {(title || description) && (
                <div className="flex items-start justify-between gap-4 pb-3 md:pt-3">
                  <div className="min-w-0">
                    {title && (
                      <h2 id={titleId} className="text-[19px] font-semibold tracking-tight text-ink">
                        {title}
                      </h2>
                    )}
                    {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="tap -mr-1 grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-ink-2"
                    aria-label="Close"
                  >
                    <X className="size-4" strokeWidth={2.2} />
                  </button>
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
            {footer && (
              <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[max(14px,var(--safe-bottom))]">
                {footer}
              </div>
            )}
            {!footer && <div className="h-[var(--safe-bottom)] shrink-0" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
