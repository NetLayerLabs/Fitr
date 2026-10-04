import type { NextConfig } from "next";

/**
 * Remote MediaPipe fallbacks the service worker may fetch (and cache) itself. The CSP below is
 * applied to the worker's own global scope, so its connect-src must allow these origins or the
 * worker's fetch() calls to them are blocked. Keep in sync with REMOTE_POSE_ASSETS in public/sw.js.
 */
const SW_REMOTE_ORIGINS = ["https://cdn.jsdelivr.net", "https://storage.googleapis.com"];

const nextConfig: NextConfig = {
  // Old tab routes from before the five-tab redesign. Permanent (308) so installed shells,
  // bookmarks and the TWA land on the new tabs. Query strings carry over automatically.
  async redirects() {
    return [
      { source: "/history", destination: "/progress", permanent: true },
      { source: "/history/:path*", destination: "/progress", permanent: true },
      { source: "/wallet", destination: "/you", permanent: true },
      { source: "/wallet/:path*", destination: "/you", permanent: true },
    ];
  },
  // Not `output: "export"`: static export ignores headers(), and the service-worker, pose-asset
  // and assetlinks headers below are required. The app still ships as static pages + a Node server.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // Always revalidate the worker script (browsers also cap this at 24h, but be explicit).
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self'; connect-src 'self' ${SW_REMOTE_ORIGINS.join(" ")}`,
          },
        ],
      },
      {
        // Pose wasm + models. The filenames are NOT versioned and the wasm must match the
        // @mediapipe/tasks-vision JS in the bundle, so a long `immutable` lifetime could pin a stale
        // wasm after an upgrade. Revalidate every time instead: ETag/Last-Modified make that a
        // cheap 304, and the service worker's cache-first pose cache (versioned by
        // POSE_ASSETS_VERSION) keeps repeat loads and offline use off the network entirely.
        source: "/mediapipe/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        // Digital Asset Links for the Android TWA (see docs/twa.md).
        source: "/.well-known/assetlinks.json",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
