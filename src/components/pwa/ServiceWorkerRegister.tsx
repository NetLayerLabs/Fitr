"use client";

import { useEffect } from "react";

const SW_URL = "/sw.js";
const CACHE_PREFIX = "fitr-"; // must match CACHE_PREFIX in public/sw.js
/** An installed PWA is rarely re-navigated, so also look for a new sw.js when it returns to the foreground. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Registers public/sw.js in production builds. In development it removes any worker and caches
 * left behind by a `next start` session on the same origin, so dev never serves stale chunks.
 * Render once, e.g. in the root layout. Renders nothing; no-op where service workers are unsupported
 * (and on insecure origins, where registration rejects).
 */
export default function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void unregisterForDev();
      return;
    }

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;
    let lastUpdateCheck = Date.now();

    const register = () => {
      navigator.serviceWorker
        .register(SW_URL, { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          if (!cancelled) registration = reg;
        })
        .catch((error: unknown) => {
          console.warn("[fitr] service worker registration failed", error);
        });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !registration) return;
      if (Date.now() - lastUpdateCheck < UPDATE_CHECK_INTERVAL_MS) return;
      lastUpdateCheck = Date.now();
      registration.update().catch(() => undefined);
    };

    // Register after `load` so the worker's precache never competes with first-load resources.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}

async function unregisterForDev(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const removed = await Promise.all(registrations.map((registration) => registration.unregister()));
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => caches.delete(name)));
    }
    if (removed.some(Boolean)) {
      console.info("[fitr] removed a production service worker in dev; reload to bypass it completely.");
    }
  } catch {
    // Best-effort cleanup only.
  }
}
