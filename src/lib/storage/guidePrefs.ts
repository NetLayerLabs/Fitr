/**
 * "Don't show the form guide again" preference, per exercise, persisted in localStorage.
 *
 * External store for useSyncExternalStore (same pattern as history.ts): getGuidePrefs() returns
 * a cached frozen object whose identity only changes when the data does. Storage failures
 * (private mode, quota) degrade to an in-memory value for this tab.
 */
import { EXERCISE_KINDS, type ExerciseKind } from "@/lib/pose/types";

export type GuidePrefs = Readonly<Record<ExerciseKind, boolean>>;

export const GUIDE_PREFS_STORAGE_KEY = "fitr.guide.v1";

/** Nothing hidden: also the server snapshot. */
export const DEFAULT_GUIDE_PREFS: GuidePrefs = Object.freeze(
  Object.fromEntries(EXERCISE_KINDS.map((kind) => [kind, false])) as Record<ExerciseKind, boolean>,
);

let cache: GuidePrefs | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): GuidePrefs {
  if (!raw) return DEFAULT_GUIDE_PREFS;
  try {
    const data: unknown = JSON.parse(raw);
    const hidden =
      typeof data === "object" && data !== null ? (data as { hidden?: unknown }).hidden : undefined;
    if (typeof hidden !== "object" || hidden === null) return DEFAULT_GUIDE_PREFS;
    const out = { ...DEFAULT_GUIDE_PREFS };
    for (const kind of EXERCISE_KINDS) out[kind] = (hidden as Record<string, unknown>)[kind] === true;
    return Object.freeze(out);
  } catch {
    return DEFAULT_GUIDE_PREFS;
  }
}

function readStorage(): GuidePrefs {
  try {
    return parse(window.localStorage.getItem(GUIDE_PREFS_STORAGE_KEY));
  } catch {
    return DEFAULT_GUIDE_PREFS;
  }
}

function emit() {
  for (const listener of Array.from(listeners)) listener();
}

export function getGuidePrefs(): GuidePrefs {
  if (typeof window === "undefined") return DEFAULT_GUIDE_PREFS;
  if (cache === null) cache = readStorage();
  return cache;
}

export function getServerGuidePrefs(): GuidePrefs {
  return DEFAULT_GUIDE_PREFS;
}

export function setGuideHidden(kind: ExerciseKind, hidden: boolean): void {
  const current = getGuidePrefs();
  if (current[kind] === hidden) return;
  const next: GuidePrefs = Object.freeze({ ...current, [kind]: hidden });
  cache = next;
  try {
    window.localStorage.setItem(GUIDE_PREFS_STORAGE_KEY, JSON.stringify({ hidden: next }));
  } catch {
    // Keep the in-memory value for this tab.
  }
  emit();
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== GUIDE_PREFS_STORAGE_KEY) return;
  cache = null;
  emit();
}

export function subscribeGuidePrefs(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** Test hook: forget the cached value so the next read goes back to storage. */
export function resetGuidePrefsCache(): void {
  cache = null;
}
