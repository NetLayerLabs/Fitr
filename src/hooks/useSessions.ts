"use client";

import { useSyncExternalStore } from "react";
import {
  getServerSnapshot,
  loadSessions,
  subscribe,
  type WorkoutSession,
} from "@/lib/storage/history";

/**
 * Local workout history, newest first. During SSR and hydration this is the constant empty
 * server snapshot (no hydration mismatch); it switches to the stored sessions right after.
 * Pair with useHydrated() to avoid flashing an empty state before the real data arrives.
 */
export function useSessions(): readonly WorkoutSession[] {
  return useSyncExternalStore(subscribe, loadSessions, getServerSnapshot);
}

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true once rendering on the client. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

// ---------------------------------------------------------------------------
// Minute-resolution wall clock (Date.now() must not be called during render).
// ---------------------------------------------------------------------------

const CLOCK_TICK_MS = 30_000;
let clockNow = 0;
let clockTimer: ReturnType<typeof setInterval> | null = null;
const clockListeners = new Set<() => void>();

function tickClock() {
  clockNow = Date.now();
  for (const listener of Array.from(clockListeners)) listener();
}

function onVisibility() {
  if (document.visibilityState === "visible") tickClock();
}

function subscribeClock(listener: () => void): () => void {
  clockListeners.add(listener);
  if (clockListeners.size === 1) {
    clockNow = Date.now();
    clockTimer = setInterval(tickClock, CLOCK_TICK_MS);
    document.addEventListener("visibilitychange", onVisibility);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0) {
      if (clockTimer !== null) clearInterval(clockTimer);
      clockTimer = null;
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

function getClockSnapshot(): number {
  if (clockNow === 0) clockNow = Date.now();
  return clockNow;
}

function getServerClockSnapshot(): number {
  return 0;
}

/**
 * Current time in ms, refreshed every 30 s and whenever the tab becomes visible, so day
 * boundaries (streaks, "today") roll over without a reload. Returns 0 during SSR/hydration.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClockSnapshot);
}
