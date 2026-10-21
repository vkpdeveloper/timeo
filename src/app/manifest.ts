import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Timeo",
    short_name: "Timeo",
    description: "Seasons, goals, focus, training and nutrition in one calm place.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    // desktop: draw into the title bar where supported, else a normal app window
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    background_color: "#F6F6F3",
    theme_color: "#F6F6F3",
    lang: "en",
    dir: "ltr",
    categories: ["productivity", "health", "fitness", "lifestyle"],
    prefer_related_applications: false,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/badge.png", sizes: "96x96", type: "image/png", purpose: "monochrome" },
    ],
    // richer install sheet on Android / desktop Chrome
    screenshots: [
      { src: "/screenshots/today.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Today" },
      { src: "/screenshots/plan.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Plan your week" },
      { src: "/screenshots/fitness.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Train with intent" },
      { src: "/screenshots/desktop.png", sizes: "2560x1600", type: "image/png", form_factor: "wide", label: "Timeo on desktop" },
    ],
    shortcuts: [
      { name: "Ask Timi", url: "/app/assistant", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Start focus", url: "/app/focus", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Log workout", url: "/app/fitness", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Plan", url: "/app/plan", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
  };
}
