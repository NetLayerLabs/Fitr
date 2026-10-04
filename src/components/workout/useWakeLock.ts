"use client";

import { useEffect } from "react";

/**
 * Keeps the screen awake while `active` (Screen Wake Lock API). The browser drops the lock
 * whenever the page is hidden, so it is re-acquired on visibilitychange. Released on
 * deactivate/unmount. Silently does nothing where unsupported or denied.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;
    let requesting = false;

    const acquire = async () => {
      if (disposed || requesting || document.visibilityState !== "visible") return;
      if (sentinel && !sentinel.released) return;
      requesting = true;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (disposed) {
          void lock.release().catch(() => {});
        } else {
          sentinel = lock;
        }
      } catch {
        // NotAllowedError (battery saver, permissions policy, not visible): ignore.
      } finally {
        requesting = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
