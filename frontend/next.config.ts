import type { NextConfig } from "next";

/**
 * Media (listing photos, shop logos/covers, avatars) is served by FastAPI,
 * but next/image's optimizer runs *server-side inside this container* —
 * where `localhost:8000` is the frontend itself, not the backend. Pointing
 * remotePatterns at the browser-facing URL therefore can't work: the
 * optimizer would be fetching from itself.
 *
 * Instead we proxy `/media/*` through Next to the backend's internal
 * address. Images then reference a same-origin relative path, so the
 * optimizer needs no allow-list at all and works in dev and prod alike.
 *
 * INTERNAL_API_URL is the container-network address (e.g. http://backend:8000);
 * NEXT_PUBLIC_API_URL stays the browser-facing one used for API calls.
 */
const internalApiUrl = (
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  // Prefer modern formats; the optimizer falls back per the Accept header.

  images: {
    // Only Google's avatar CDN needs allow-listing — everything else is
    // same-origin via the rewrite below.
    remotePatterns: [new URL("https://lh3.googleusercontent.com/**")],
  },
  async rewrites() {
    return [{ source: "/media/:path*", destination: `${internalApiUrl}/media/:path*` }];
  },
};

export default nextConfig;
