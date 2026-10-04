"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(display-mode: standalone)";

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener?.("change", onChange);
  return () => mql.removeEventListener?.("change", onChange);
}

function isStandalone(): boolean {
  const media = typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
  // iOS home-screen web apps report this instead of the media query on older versions.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return media || iosStandalone;
}

const serverSnapshot = () => false;

/**
 * True when Fitr runs as an installed app (home-screen PWA / Android TWA): there is no address
 * bar, so browser-tab instructions ("tap the icon next to the address") do not apply.
 * false during SSR and on the first client render.
 */
export function useStandaloneDisplay(): boolean {
  return useSyncExternalStore(subscribe, isStandalone, serverSnapshot);
}
