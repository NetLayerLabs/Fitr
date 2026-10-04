/* Fitr service worker. Hand-written, no Workbox, no build step.
 *
 * Registered by src/components/pwa/ServiceWorkerRegister.tsx (production only) at scope "/".
 *
 * Caches (all names start with CACHE_PREFIX; activate deletes any that are not current):
 *   shell  fitr-shell-<VERSION>    HTML for navigations. Network-first, cache fallback, then /offline.
 *   assets fitr-assets-<VERSION>   Icons, manifest, other same-origin static files. Stale-while-revalidate.
 *   static fitr-static-v1          /_next/static/** (content-hashed, immutable). Cache-first. Deliberately
 *                                  NOT tied to VERSION, so an SW update never drops chunks an open page
 *                                  may still lazy-load. Trimmed oldest-first to MAX_STATIC_ENTRIES, but
 *                                  never evicting a chunk that a cached shell page references (hits do
 *                                  not refresh an entry's age, so the oldest entries are often exactly
 *                                  the shared runtime/framework chunks every page needs offline).
 *   pose   fitr-pose-<POSE_ASSETS_VERSION>  /mediapipe/** plus the remote MediaPipe fallbacks (CORS
 *                                  responses only). Cache-first. Bump POSE_ASSETS_VERSION whenever
 *                                  @mediapipe/tasks-vision or the model files change: the wasm must match
 *                                  the JS API version, and these URLs are not content-hashed.
 *
 * Update strategy: skipWaiting() right after install, clients.claim() on activate.
 *   - This file changes rarely and does not version app code (Next's hashed chunks do), so a new
 *     worker is safe to take over open pages: navigations are network-first, and the static cache
 *     survives the swap, so an already-open page can still load its old chunks.
 *   - An installed PWA/TWA is almost never fully closed, so a worker left "waiting" would keep
 *     the old caching logic for days. A "new version, tap to reload" prompt is not worth it here.
 *   - The page is never reloaded automatically (that would kill a workout in progress).
 *   - A 'SKIP_WAITING' message is still honoured, for a future update prompt.
 *
 * Never cached: non-GET, Range requests / 206 responses, opaque or error responses, RSC payloads,
 * API calls, and anything cross-origin except the MediaPipe CDN fallbacks.
 */

const VERSION = "2026-10-04.1";
const POSE_ASSETS_VERSION = "mp-1.0.1";

const CACHE_PREFIX = "fitr-";
const CACHES = {
  shell: `${CACHE_PREFIX}shell-${VERSION}`,
  assets: `${CACHE_PREFIX}assets-${VERSION}`,
  static: `${CACHE_PREFIX}static-v1`,
  pose: `${CACHE_PREFIX}pose-${POSE_ASSETS_VERSION}`,
};

const OFFLINE_PATH = "/offline";
const APP_SHELL = ["/", "/history", "/workout/pushup", "/workout/squat", "/workout/plank", OFFLINE_PATH];

/** How long a navigation waits for the network before a cached copy is served instead. */
const NAV_TIMEOUT_MS = 4000;
const MAX_STATIC_ENTRIES = 400;
/** Cap on /_next/static URLs discovered in the precached HTML, as a guard against runaway parsing. */
const MAX_PRECACHE_STATIC = 200;

const REMOTE_POSE_ASSETS = [
  { host: "cdn.jsdelivr.net", pathPrefix: "/npm/@mediapipe/" },
  { host: "storage.googleapis.com", pathPrefix: "/mediapipe-models/" },
];

const STATIC_ASSET_PATHS = new Set(["/manifest.webmanifest", "/favicon.ico", "/icon.png", "/apple-icon.png"]);
const STATIC_ASSET_EXT = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|css|js|webmanifest)$/i;

// ---------------------------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheAppShell()
      .catch(() => undefined) // precaching is best-effort; it must never fail the install
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set(Object.values(CACHES));
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && !keep.has(name))
          .map((name) => caches.delete(name)),
      );
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {
          // Not fatal: navigations simply fetch without preload.
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data === "SKIP_WAITING" || (data && data.type === "SKIP_WAITING")) {
    self.skipWaiting();
  }
});

// ---------------------------------------------------------------------------------------------
// Fetch routing
// ---------------------------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.headers.has("range")) return; // media/byte-range requests go straight to the network
  // DevTools quirk: only-if-cached is only valid for same-origin mode.
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin === self.location.origin) {
    const path = url.pathname;
    if (path.startsWith("/mediapipe/")) {
      event.respondWith(cacheFirst(event, CACHES.pose, { dedupeByPath: true }));
      return;
    }
    if (path.startsWith("/_next/static/")) {
      event.respondWith(cacheFirst(event, CACHES.static, { maxEntries: MAX_STATIC_ENTRIES }));
      return;
    }
    if (request.mode === "navigate") {
      event.respondWith(networkFirstNavigation(event));
      return;
    }
    if (isStaticAsset(url, request)) {
      event.respondWith(staleWhileRevalidate(event, CACHES.assets));
    }
    // Everything else (RSC payloads, /_next/data, route handlers, /sw.js...) uses the network as-is.
    return;
  }

  // Cross-origin: only the MediaPipe CDN fallbacks, and only CORS requests (fetch/wasm/model loads).
  // no-cors requests (e.g. a <script> tag) would produce opaque responses, so they pass through.
  if (request.mode === "cors" && isRemotePoseAsset(url)) {
    event.respondWith(cacheFirst(event, CACHES.pose, { requireCors: true, dedupeByPath: true }));
  }
});

function isStaticAsset(url, request) {
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/.well-known/")) return false;
  if (url.pathname === "/sw.js") return false;
  if (url.searchParams.has("_rsc") || request.headers.has("rsc")) return false;
  if (STATIC_ASSET_PATHS.has(url.pathname) || url.pathname.startsWith("/icons/")) return true;
  return STATIC_ASSET_EXT.test(url.pathname);
}

function isRemotePoseAsset(url) {
  return (
    url.protocol === "https:" &&
    REMOTE_POSE_ASSETS.some(({ host, pathPrefix }) => url.hostname === host && url.pathname.startsWith(pathPrefix))
  );
}

// ---------------------------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------------------------

/**
 * Cache-first. On a miss, fetch and store a copy in the background.
 * options.requireCors: only store `type: "cors"` responses (cross-origin).
 * options.dedupeByPath: after storing, drop entries with the same path but another query
 *   (e.g. a `?v=` bump), so old multi-MB model/wasm copies do not pile up.
 * options.maxEntries: trim the cache to this many entries after storing (see trimCache).
 */
async function cacheFirst(event, cacheName, options = {}) {
  const { request } = event;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheable(response, options.requireCors)) {
    const copy = response.clone();
    event.waitUntil(
      (async () => {
        await cache.put(request, copy);
        if (options.dedupeByPath) await deleteSiblings(cache, request.url);
        if (options.maxEntries) await trimCache(cache, options.maxEntries);
      })().catch(() => undefined), // quota errors etc. must not surface to the page
    );
  }
  return response;
}

/** Stale-while-revalidate: answer from cache when possible, always refresh in the background. */
async function staleWhileRevalidate(event, cacheName) {
  const { request } = event;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });

  const network = fetch(request).then((response) => {
    if (isCacheable(response, false)) {
      const copy = response.clone();
      event.waitUntil(cache.put(request, copy).catch(() => undefined));
    }
    return response;
  });
  event.waitUntil(network.then(noop, noop));

  return cached || network;
}

/**
 * Navigations: network-first (with navigation preload), keep a copy of successful HTML.
 * If the network fails, or is slower than NAV_TIMEOUT_MS while a cached copy exists, serve the
 * cached page; with no cached page, wait for the network and finally fall back to /offline.
 */
async function networkFirstNavigation(event) {
  const { request } = event;
  const key = shellKey(request.url);

  const network = (async () => {
    const preloaded = await event.preloadResponse;
    const response = preloaded || (await fetch(request));
    if (isCacheableHtml(response)) {
      const copy = response.clone();
      event.waitUntil(storeShell(key, copy).catch(() => undefined));
    }
    return response;
  })();
  event.waitUntil(network.then(noop, noop)); // late responses still refresh the cache

  const first = await Promise.race([
    network.then(
      (response) => ({ response }),
      () => ({ failed: true }),
    ),
    delay(NAV_TIMEOUT_MS).then(() => ({ timedOut: true })),
  ]);
  if (first.response) return first.response;

  const cached = await matchShell(key);
  if (cached) return cached;

  if (first.timedOut) {
    try {
      return await network;
    } catch {
      // fall through to the offline page
    }
  }
  const offline = await matchShell(shellKey(new URL(OFFLINE_PATH, self.location.origin).href));
  return offline || offlineFallbackResponse();
}

// ---------------------------------------------------------------------------------------------
// Precache
// ---------------------------------------------------------------------------------------------

/**
 * Fetch each shell route individually (one failure never breaks the install), then precache the
 * /_next/static JS/CSS/fonts those pages reference so every shell route can boot offline, not
 * just the ones the user happened to open while online.
 */
async function precacheAppShell() {
  const staticUrls = new Set();
  await Promise.all(
    APP_SHELL.map(async (path) => {
      try {
        const url = new URL(path, self.location.origin).href;
        const response = await fetch(new Request(url, { cache: "reload", credentials: "same-origin" }));
        if (!isCacheableHtml(response)) return;
        const html = await response.clone().text();
        for (const assetUrl of extractStaticAssetUrls(html)) staticUrls.add(assetUrl);
        await storeShell(shellKey(url), response);
      } catch {
        // Skip this route; it will be cached on its first successful visit.
      }
    }),
  );

  const cache = await caches.open(CACHES.static);
  await Promise.all(
    [...staticUrls].slice(0, MAX_PRECACHE_STATIC).map(async (assetUrl) => {
      try {
        if (await cache.match(assetUrl)) return;
        const response = await fetch(assetUrl, { credentials: "same-origin" });
        if (isCacheable(response, false)) await cache.put(assetUrl, response);
      } catch {
        // Best-effort: missing chunks are fetched (and cached) on demand.
      }
    }),
  );
  await trimCache(cache, MAX_STATIC_ENTRIES).catch(() => undefined);
}

/** /_next/static URLs in the HTML, including chunk paths inside the inline RSC payload. */
function extractStaticAssetUrls(html) {
  const found = new Set();
  const pattern = /\/_next\/static\/[^"'\s\\<>()]+?\.(?:js|css|woff2?|ttf|otf)(?![\w-])(?:\?[^"'\s\\<>()]*)?/g;
  for (const match of html.matchAll(pattern)) {
    found.add(new URL(match[0], self.location.origin).href);
  }
  return found;
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function noop() {}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 200 only: excludes 206 partial content, redirects, errors and opaque (status 0) responses. */
function isCacheable(response, requireCors) {
  if (!response || response.status !== 200) return false;
  if (requireCors) return response.type === "cors";
  return response.type === "basic" || response.type === "default";
}

function isCacheableHtml(response) {
  if (!isCacheable(response, false)) return false;
  const type = response.headers.get("content-type") || "";
  return type.includes("text/html");
}

/** Shell entries are keyed by origin + path, so ?query variants of a page share one entry. */
function shellKey(href) {
  const url = new URL(href);
  return url.origin + url.pathname;
}

async function storeShell(key, response) {
  const cache = await caches.open(CACHES.shell);
  await cache.put(key, await withoutRedirectFlag(response));
}

async function matchShell(key) {
  const cache = await caches.open(CACHES.shell);
  return cache.match(key, { ignoreSearch: true, ignoreVary: true });
}

/**
 * A response with `redirected: true` cannot answer a navigation (redirect mode "manual"), so
 * store a plain copy instead.
 */
async function withoutRedirectFlag(response) {
  if (!response.redirected) return response;
  const body = await response.blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function deleteSiblings(cache, href) {
  const target = new URL(href);
  const keys = await cache.keys();
  await Promise.all(
    keys
      .filter((key) => {
        const url = new URL(key.url);
        return url.origin === target.origin && url.pathname === target.pathname && url.href !== target.href;
      })
      .map((key) => cache.delete(key)),
  );
}

/**
 * Trim to maxEntries, oldest first (Cache.keys() is in insertion order), skipping every asset a
 * cached app-shell page references: those are what an offline boot needs, however old they are.
 */
async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  if (excess <= 0) return;
  const keep = await shellReferencedUrls();
  const victims = [];
  for (const key of keys) {
    if (victims.length >= excess) break;
    if (!keep.has(key.url)) victims.push(key);
  }
  await Promise.all(victims.map((key) => cache.delete(key)));
}

/** /_next/static URLs referenced by any page in the shell cache. Best-effort. */
async function shellReferencedUrls() {
  const found = new Set();
  try {
    const shell = await caches.open(CACHES.shell);
    for (const key of await shell.keys()) {
      const response = await shell.match(key);
      if (!response) continue;
      for (const url of extractStaticAssetUrls(await response.text())) found.add(url);
    }
  } catch {
    // Unreadable shell cache: fall back to plain oldest-first trimming.
  }
  return found;
}

function offlineFallbackResponse() {
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="theme-color" content="#0A0B0D"><title>Offline · Fitr</title></head>' +
    '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#0A0B0D;color:#E8EAED;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px">' +
    '<main><p style="color:#C6F432;font-weight:700;letter-spacing:.08em">FITR</p>' +
    "<h1 style=\"font-size:22px\">You're offline</h1>" +
    "<p style=\"opacity:.7\">Reconnect and try again.</p>" +
    '<p><a href="" style="color:#C6F432">Try again</a></p></main></body></html>';
  return new Response(html, {
    status: 503,
    statusText: "Offline",
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
