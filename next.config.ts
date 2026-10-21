import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app moved under /app (the landing page took "/"). Old links, shortcuts and sent notifications still land.
  async redirects() {
    return [
      { source: "/welcome", destination: "/", permanent: false },
      ...["plan", "goals", "fitness", "review", "settings", "focus", "assistant"].flatMap((p) => [
        { source: `/${p}`, destination: `/app/${p}`, permanent: false },
        { source: `/${p}/:path*`, destination: `/app/${p}/:path*`, permanent: false },
      ]),
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
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
