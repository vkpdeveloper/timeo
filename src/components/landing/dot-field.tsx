"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * A calm dot grid on canvas. Once a second a clock hand, centred on the content,
 * lights a few dots in the accent; they fade over the next seconds, so the trail
 * reads like the minute passing. Solid dots, opacity only.
 *
 * Content that should stay clear of dots carries `data-dots-clear` and sits inside
 * the same parent as the canvas. Pauses when hidden or offscreen; a still frame for
 * reduced motion.
 */
export function DotField({ variant = "hero", className }: { variant?: "hero" | "quiet"; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;

    const quiet = variant === "quiet";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dark = window.matchMedia("(prefers-color-scheme: dark)");

    // Colours come from the theme variables, resolved through a probe element.
    const probe = document.createElement("span");
    probe.style.display = "none";
    host.appendChild(probe);
    const resolve = (v: string) => {
      probe.style.color = `var(${v})`;
      return getComputedStyle(probe).color;
    };

    let w = 0;
    let h = 0;
    let dpr = 1;
    let ink = "";
    let accent = "";
    let isDark = false;
    let xs = new Float32Array(0);
    let ys = new Float32Array(0);
    let fade = new Float32Array(0); // 0..1, how visible each dot may be
    let lit = new Float64Array(0); // when each dot last lit (ms), or -Infinity
    let level = new Float32Array(0); // how bright it lit
    let cx = 0;
    let cy = 0;
    const base = document.createElement("canvas");

    const TAU = quiet ? 5200 : 7000; // fade time constant (ms)
    const RISE = 280;
    let R = 1.25; // dot radius (css px)

    function layout() {
      const rect = host!.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const c of [canvas!, base]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;

      const gap = w < 640 ? 20 : 26;
      R = w < 640 ? 1.25 : 1.4;
      const cols = Math.floor(w / gap) + 1;
      const rows = Math.floor(h / gap) + 1;
      const ox = (w - (cols - 1) * gap) / 2;
      const oy = (h - (rows - 1) * gap) / 2;
      const n = cols * rows;
      xs = new Float32Array(n);
      ys = new Float32Array(n);
      fade = new Float32Array(n);
      lit = new Float64Array(n).fill(-Infinity);
      level = new Float32Array(n);

      // keep-out boxes around content, padded
      // data-dots-clear="card": a solid card on wider screens, so dots may come close
      const boxes = Array.from(host!.querySelectorAll<HTMLElement>("[data-dots-clear]"), (el) => {
        const r = el.getBoundingClientRect();
        const card = el.dataset.dotsClear === "card" && w >= 640;
        const pad = card ? 14 : w < 640 ? 18 : 40;
        const soft = card ? 36 : w < 640 ? 70 : 140;
        return { l: r.left - rect.left - pad, t: r.top - rect.top - pad, r: r.right - rect.left + pad, b: r.bottom - rect.top + pad, soft };
      });
      if (boxes.length) {
        // the hand turns around the largest clear box
        const b = boxes.reduce((a, c) => ((c.r - c.l) * (c.b - c.t) > (a.r - a.l) * (a.b - a.t) ? c : a));
        cx = (b.l + b.r) / 2;
        cy = (b.t + b.b) / 2;
      } else {
        cx = w / 2;
        cy = h / 2;
      }

      let i = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++, i++) {
          const x = ox + col * gap;
          const y = oy + row * gap;
          xs[i] = x;
          ys[i] = y;
          let f = 1;
          for (const b of boxes) {
            const dx = Math.max(b.l - x, 0, x - b.r);
            const dy = Math.max(b.t - y, 0, y - b.b);
            f = Math.min(f, smooth(Math.hypot(dx, dy) / b.soft));
          }
          // ease out towards the bottom edge so the field settles into the page
          f *= smooth((h - y) / (h * (quiet ? 0.12 : 0.28)));
          fade[i] = f;
        }
      }
    }

    function colours() {
      ink = resolve("--ink");
      accent = resolve("--accent");
      const m = document.documentElement.getAttribute("data-mode");
      isDark = m === "dark" || (m !== "light" && dark.matches);
    }

    function paintBase() {
      const b = base.getContext("2d")!;
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.clearRect(0, 0, w, h);
      b.fillStyle = ink;
      const top = (isDark ? 0.16 : 0.13) * (quiet ? 0.75 : 1);
      // a few alpha buckets keep this to a handful of fills
      const buckets = 8;
      for (let k = 1; k <= buckets; k++) {
        b.globalAlpha = (top * k) / buckets;
        b.beginPath();
        for (let i = 0; i < xs.length; i++) {
          if (Math.ceil(fade[i] * buckets) !== k) continue;
          b.moveTo(xs[i] + R, ys[i]);
          b.arc(xs[i], ys[i], R, 0, Math.PI * 2);
        }
        b.fill();
      }
    }

    /** Light the dots under the hand for this second, plus a few strays. */
    function tick(sec: number, at: number) {
      const angle = ((sec % 60) / 60) * Math.PI * 2 - Math.PI / 2;
      const width = quiet ? 0.035 : 0.05;
      const chance = quiet ? 0.35 : 0.55;
      for (let i = 0; i < xs.length; i++) {
        if (fade[i] < 0.05) continue;
        let d = Math.atan2(ys[i] - cy, xs[i] - cx) - angle;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) < width && Math.random() < chance) {
          lit[i] = at;
          level[i] = 0.55 + Math.random() * 0.45;
        }
      }
      const strays = Math.round(xs.length / (quiet ? 900 : 450));
      for (let s = 0; s < strays; s++) {
        const i = Math.floor(Math.random() * xs.length);
        if (fade[i] < 0.05) continue;
        lit[i] = at;
        level[i] = 0.35 + Math.random() * 0.3;
      }
    }

    function draw(now: number) {
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.drawImage(base, 0, 0);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.fillStyle = accent;
      const peak = (isDark ? 0.9 : 0.85) * (quiet ? 0.6 : 1);
      for (let i = 0; i < xs.length; i++) {
        const t = now - lit[i];
        if (!(t >= 0)) continue;
        const a = t < RISE ? t / RISE : Math.exp(-(t - RISE) / TAU);
        if (a < 0.02) continue;
        ctx!.globalAlpha = a * level[i] * fade[i] * peak;
        ctx!.beginPath();
        ctx!.arc(xs[i], ys[i], R, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    /** Reduced motion: the trail of the last half minute, drawn once. */
    function still() {
      const now = 1e7;
      const sec = Math.floor(Date.now() / 1000);
      for (let k = 30; k >= 0; k--) tick(sec - k, now - k * 1000);
      draw(now);
    }

    let raf = 0;
    let last = 0;
    let lastSec = 0;
    let onScreen = true;

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; // ~30 fps is plenty for slow fades
      last = now;
      const sec = Math.floor(Date.now() / 1000);
      if (sec !== lastSec) {
        // after a pause, pick up at the current second without replaying the gap
        if (sec - lastSec > 3) lastSec = sec - 1;
        for (let s = lastSec + 1; s <= sec; s++) tick(s, now);
        lastSec = sec;
      }
      draw(now);
    }

    function start() {
      stop();
      if (reduce.matches) return still();
      if (!onScreen || document.visibilityState !== "visible") return;
      lastSec = Math.floor(Date.now() / 1000) - 1;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    function rebuild() {
      layout();
      colours();
      paintBase();
      if (reduce.matches) still();
      else draw(performance.now());
    }

    function warm() {
      // seed a short trail so the first frame is not empty
      const now = performance.now();
      const sec = Math.floor(Date.now() / 1000);
      for (let k = 12; k >= 1; k--) tick(sec - k, now - k * 1000);
    }

    rebuild();
    if (!reduce.matches) warm();
    start();
    canvas.dataset.ready = "";

    // re-lay out when the host or the content around which dots clear changes size
    const clears = Array.from(host.querySelectorAll<HTMLElement>("[data-dots-clear]"));
    const key = () => [host, ...clears].map((el) => `${Math.round(el.offsetWidth)}x${Math.round(el.offsetHeight)}`).join();
    let laidOut = key();
    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const next = key();
        if (next === laidOut) return;
        laidOut = next;
        rebuild();
        if (!reduce.matches) warm();
      }, 120);
    });
    for (const el of [host, ...clears]) ro.observe(el);

    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    io.observe(canvas);

    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    const onTheme = () => {
      colours();
      paintBase();
      if (reduce.matches) still();
      else draw(performance.now());
    };
    const mo = new MutationObserver(onTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode", "data-theme", "style", "class"] });
    document.addEventListener("visibilitychange", onVisibility);
    dark.addEventListener("change", onTheme);
    reduce.addEventListener("change", start);

    return () => {
      stop();
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      dark.removeEventListener("change", onTheme);
      reduce.removeEventListener("change", start);
      probe.remove();
    };
  }, [variant]);

  return <canvas ref={ref} aria-hidden className={cn("dot-field pointer-events-none absolute inset-0", className)} />;
}

function smooth(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
