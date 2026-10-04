"use client";

/**
 * App preferences set on the You tab (default camera, haptics, voice coach), persisted in localStorage.
 *
 * External store for useSyncExternalStore, same pattern as lib/storage/guidePrefs.ts:
 * getPreferences() returns a cached frozen object whose identity only changes with the data.
 * Storage failures (private mode, blocked site data, quota) degrade to an in-memory value.
 *
 * Consumers outside this tab (the workout screen) read them with getPreferences() or
 * usePreferences(): `camera` is the facingMode to open first, `haptics` gates navigator.vibrate,
 * `voiceCoach` gates spoken rep counts and cues (components/workout/voiceCoach.ts).
 */
import { useSyncExternalStore } from "react";

export type CameraFacing = "user" | "environment";

export interface AppPreferences {
  /** Camera the workout screen opens first: "user" (front/selfie) or "environment" (back). */
  camera: CameraFacing;
  /** Vibrate on counted reps and on reaching the goal. */
  haptics: boolean;
  /** Speak rep counts, milestones, form cues and live checks during a workout. */
  voiceCoach: boolean;
}

export const PREFERENCES_STORAGE_KEY = "fitr.prefs.v1";

export const DEFAULT_PREFERENCES: Readonly<AppPreferences> = Object.freeze({
  camera: "user",
  haptics: true,
  voiceCoach: true,
});

let cache: Readonly<AppPreferences> | null = null;
const listeners = new Set<() => void>();

export function parsePreferences(raw: string | null): Readonly<AppPreferences> {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || Array.isArray(data)) return DEFAULT_PREFERENCES;
    const d = data as Record<string, unknown>;
    return Object.freeze({
      camera: d.camera === "environment" || d.camera === "user" ? d.camera : DEFAULT_PREFERENCES.camera,
      haptics: typeof d.haptics === "boolean" ? d.haptics : DEFAULT_PREFERENCES.haptics,
      voiceCoach: typeof d.voiceCoach === "boolean" ? d.voiceCoach : DEFAULT_PREFERENCES.voiceCoach,
    });
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function readStorage(): Readonly<AppPreferences> {
  try {
    return parsePreferences(window.localStorage.getItem(PREFERENCES_STORAGE_KEY));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function emit() {
  for (const listener of Array.from(listeners)) listener();
}

export function getPreferences(): Readonly<AppPreferences> {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  if (cache === null) cache = readStorage();
  return cache;
}

export function getServerPreferences(): Readonly<AppPreferences> {
  return DEFAULT_PREFERENCES;
}

export function setPreference<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]): void {
  const current = getPreferences();
  if (current[key] === value) return;
  const next: Readonly<AppPreferences> = Object.freeze({ ...current, [key]: value });
  cache = next;
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Keep the in-memory value for this tab.
  }
  emit();
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== PREFERENCES_STORAGE_KEY) return;
  cache = null;
  emit();
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** Current preferences; the defaults during SSR and hydration. */
export function usePreferences(): Readonly<AppPreferences> {
  return useSyncExternalStore(subscribePreferences, getPreferences, getServerPreferences);
}

/** Test hook: forget the cached value so the next read goes back to storage. */
export function resetPreferencesCache(): void {
  cache = null;
}
