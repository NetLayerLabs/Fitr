/**
 * Local workout history, persisted in localStorage.
 *
 * Designed as an external store for React's useSyncExternalStore:
 *   - loadSessions() (alias getSnapshot) returns a cached, frozen array. The same reference is
 *     returned until the data changes (save / clear / reload / cross-tab 'storage' event).
 *   - subscribe(listener) notifies on every change, including writes from other tabs.
 *
 * All storage access is wrapped in try/catch: private modes, disabled storage or quota errors
 * degrade to an in-memory list for the current tab instead of crashing the app.
 */
import { isExerciseKind, type ExerciseKind, type SessionSummary } from "@/lib/pose/types";

export interface WorkoutSession {
  id: string;
  exercise: ExerciseKind;
  /** Wall-clock ms (Date.now()) when the session was started. */
  startedAt: number;
  /** Wall-clock ms (Date.now()) when the session was ended. */
  endedAt: number;
  /** Goal for this session in the exercise's unit (reps, or seconds for plank). */
  goal: number;
  goalMet: boolean;
  summary: SessionSummary;
}

export const SESSIONS_STORAGE_KEY = "fitr.sessions.v1";
/** Only the newest sessions (by startedAt) are kept. */
export const MAX_STORED_SESSIONS = 500;
/** Shared empty snapshot (also the server snapshot), so identity never churns. */
export const EMPTY_SESSIONS: readonly WorkoutSession[] = Object.freeze([]);

const MAX_ID_LENGTH = 128;

// ---------------------------------------------------------------------------
// Parsing / validation
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function count(value: unknown): number | null {
  const n = nonNegative(value);
  return n === null ? null : Math.floor(n);
}

function parseSummary(raw: unknown, exercise: ExerciseKind): SessionSummary | null {
  if (!isRecord(raw)) return null;
  const reps = count(raw.reps);
  const rejectedReps = count(raw.rejectedReps);
  const holdMs = nonNegative(raw.holdMs);
  if (reps === null || rejectedReps === null || holdMs === null) return null;

  const durations = Array.isArray(raw.repDurationsMs) ? raw.repDurationsMs : [];
  const confidence = nonNegative(raw.avgTrackingConfidence);

  return {
    exercise,
    reps,
    rejectedReps,
    holdMs,
    repDurationsMs: durations.filter((d): d is number => nonNegative(d) !== null),
    activeMs: nonNegative(raw.activeMs) ?? 0,
    framesProcessed: count(raw.framesProcessed) ?? 0,
    framesWithPose: count(raw.framesWithPose) ?? 0,
    avgTrackingConfidence: confidence === null ? 0 : Math.min(1, confidence),
  };
}

/**
 * Validates and normalizes one stored session. Returns null for anything that is not a
 * structurally valid session (wrong types, unknown exercise, missing core stats).
 * Unknown extra fields are dropped.
 */
export function parseSession(raw: unknown): WorkoutSession | null {
  if (!isRecord(raw)) return null;
  const { id, exercise, goalMet } = raw;
  if (typeof id !== "string" || id.length === 0 || id.length > MAX_ID_LENGTH) return null;
  if (typeof exercise !== "string" || !isExerciseKind(exercise)) return null;
  if (typeof goalMet !== "boolean") return null;
  const startedAt = nonNegative(raw.startedAt);
  const endedAt = nonNegative(raw.endedAt);
  const goal = nonNegative(raw.goal);
  if (startedAt === null || endedAt === null || goal === null) return null;
  const summary = parseSummary(raw.summary, exercise);
  if (!summary) return null;
  return {
    id,
    exercise,
    startedAt,
    // Tolerate small clock adjustments rather than dropping the session.
    endedAt: Math.max(startedAt, endedAt),
    goal,
    goalMet,
    summary,
  };
}

/** Newest first, de-duplicated by id (first occurrence wins), capped. */
function normalizeList(sessions: WorkoutSession[]): WorkoutSession[] {
  const seen = new Set<string>();
  const unique: WorkoutSession[] = [];
  for (const s of sessions) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    unique.push(s);
  }
  unique.sort((a, b) => b.startedAt - a.startedAt);
  return unique.length > MAX_STORED_SESSIONS ? unique.slice(0, MAX_STORED_SESSIONS) : unique;
}

/** Parses the raw storage string. Corrupt JSON or a non-array yields []; invalid entries are skipped. */
export function parseSessions(raw: string | null): WorkoutSession[] {
  if (raw === null || raw === "") return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const valid: WorkoutSession[] = [];
  for (const entry of data) {
    const session = parseSession(entry);
    if (session) valid.push(session);
  }
  return normalizeList(valid);
}

// ---------------------------------------------------------------------------
// Storage access (always guarded)
// ---------------------------------------------------------------------------

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    // Accessing localStorage throws a SecurityError when site data is blocked.
    return null;
  }
}

function readRaw(): string | null {
  try {
    return getStorage()?.getItem(SESSIONS_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeRaw(value: string): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;
    storage.setItem(SESSIONS_STORAGE_KEY, value);
    return true;
  } catch {
    // QuotaExceededError, private mode, etc.
    return false;
  }
}

function removeRaw(): void {
  try {
    getStorage()?.removeItem(SESSIONS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// External store
// ---------------------------------------------------------------------------

let cache: readonly WorkoutSession[] | null = null;
const listeners = new Set<() => void>();

function freeze(list: WorkoutSession[]): readonly WorkoutSession[] {
  return list.length === 0 ? EMPTY_SESSIONS : Object.freeze(list);
}

function emit(): void {
  for (const listener of Array.from(listeners)) listener();
}

/**
 * Current sessions, newest first. Returns the same (frozen) array reference until the data
 * changes, so it is safe to use directly as a useSyncExternalStore getSnapshot.
 */
export function loadSessions(): readonly WorkoutSession[] {
  if (cache) return cache;
  // Never cache on the server: module state would be shared across requests.
  if (typeof window === "undefined") return EMPTY_SESSIONS;
  cache = freeze(parseSessions(readRaw()));
  return cache;
}

/** useSyncExternalStore snapshot getter (alias of loadSessions). */
export const getSnapshot = loadSessions;

/** useSyncExternalStore server snapshot: always the same empty array. */
export function getServerSnapshot(): readonly WorkoutSession[] {
  return EMPTY_SESSIONS;
}

/**
 * Inserts (or replaces, by id) a session and notifies subscribers.
 * Returns true when it was persisted to localStorage; false when storage is unavailable or
 * full, in which case the session is still kept in memory for this tab.
 * Throws a TypeError for a structurally invalid session (programming error).
 */
export function saveSession(session: WorkoutSession): boolean {
  const normalized = parseSession(session);
  if (!normalized) throw new TypeError("saveSession: invalid WorkoutSession");
  const current = loadSessions();
  const next = normalizeList([normalized, ...current.filter((s) => s.id !== normalized.id)]);
  const persisted = writeRaw(JSON.stringify(next));
  cache = freeze(next);
  emit();
  return persisted;
}

/** Deletes all stored sessions and notifies subscribers. */
export function clearSessions(): void {
  removeRaw();
  cache = EMPTY_SESSIONS;
  emit();
}

/** Drops the cache and re-reads storage on the next snapshot (e.g. after external writes). */
export function reloadSessions(): void {
  cache = null;
  emit();
}

function onStorage(event: StorageEvent): void {
  // key === null means another tab called localStorage.clear().
  if (event.key !== null && event.key !== SESSIONS_STORAGE_KEY) return;
  reloadSessions();
}

/** Subscribes to changes (this tab and other tabs). Returns the unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/** Random session id; falls back when crypto.randomUUID is unavailable (insecure context). */
export function createSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
