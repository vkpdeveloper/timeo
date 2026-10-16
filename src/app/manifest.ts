import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Timeo",
    short_name: "Timeo",
    description: "Seasons, goals, focus, training and nutrition in one calm place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f4f0",
    theme_color: "#f5f4f0",
    categories: ["productivity", "health", "fitness", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Start focus", url: "/focus", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Log workout", url: "/fitness", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
