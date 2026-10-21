"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { Bell, Download, WifiOff } from "lucide-react";
import { BrowserFrame } from "./phone-frame";
import { Reveal, Words } from "./motion";

const POINTS = [
  { icon: Download, title: "Install from the browser", body: "Add it to your home screen. No app store, no update prompts." },
  { icon: WifiOff, title: "Works offline", body: "Your last copy opens instantly, even on a train with no signal." },
  { icon: Bell, title: "Notifies you", body: "Block starts, focus ends, and Timi’s results arrive as notifications." },
];

export function Pwa() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.88, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.4], [0.3, 1]);

  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28">
      <Reveal>
        <p className="eyebrow">Built for your phone</p>
      </Reveal>
      <h2 className="display mt-3 max-w-[20ch] text-[36px] leading-[1.04] tracking-[-0.015em] sm:text-[52px]">
        <Words text="Fast in your pocket. Roomy on your desk." inView />
      </h2>

      <div className="mt-10 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {POINTS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.1} className="card flex gap-4 p-4 sm:block sm:p-6">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <p.icon className="size-5" strokeWidth={2} />
            </span>
            <div>
              <h3 className="text-[17px] font-semibold sm:mt-4">{p.title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{p.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div ref={ref} className="mt-12 [perspective:1600px] sm:mt-16">
        <motion.div style={{ rotateX, scale, opacity, transformOrigin: "50% 100%" }}>
          <BrowserFrame src="/landing/desktop.png" alt="Timeo on a desktop browser" sizes="(min-width: 1200px) 1100px, 92vw" />
        </motion.div>
      </div>
    </section>
  );
}
