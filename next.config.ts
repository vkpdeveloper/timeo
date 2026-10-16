import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    // Keep visited screens in the in-memory router cache for 5 minutes so tab
    // switches are instant. Server actions call refresh(), which clears it.
    staleTimes: { dynamic: 300, static: 1800 },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
