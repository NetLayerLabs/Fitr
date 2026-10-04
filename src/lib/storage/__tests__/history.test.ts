// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_SESSIONS,
  MAX_STORED_SESSIONS,
  SESSIONS_STORAGE_KEY,
  clearSessions,
  getServerSnapshot,
  loadSessions,
  parseSession,
  reloadSessions,
  saveSession,
  subscribe,
  type WorkoutSession,
} from "../history";

let seq = 0;
function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  seq++;
  const startedAt = overrides.startedAt ?? 1_700_000_000_000 + seq * 1000;
  return {
    id: `id-${seq}`,
    exercise: "squat",
    startedAt,
    endedAt: startedAt + 30_000,
    goal: 25,
    goalMet: false,
    summary: {
      exercise: "squat",
      reps: 12,
      rejectedReps: 1,
      holdMs: 0,
      repDurationsMs: [1500, 1600],
      activeMs: 28_000,
      framesProcessed: 800,
      framesWithPose: 790,
      avgTrackingConfidence: 0.87,
    },
    ...overrides,
  };
}

function writeRaw(value: unknown) {
  localStorage.setItem(SESSIONS_STORAGE_KEY, typeof value === "string" ? value : JSON.stringify(value));
  reloadSessions();
}

beforeEach(() => {
  localStorage.clear();
  reloadSessions();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadSessions", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(loadSessions()).toEqual([]);
    expect(loadSessions()).toBe(EMPTY_SESSIONS);
  });

  it("returns [] for corrupt JSON without throwing", () => {
    writeRaw("{not json");
    expect(loadSessions()).toEqual([]);
  });

  it("returns [] when the stored value is not an array", () => {
    writeRaw({ sessions: [makeSession()] });
    expect(loadSessions()).toEqual([]);
  });

  it("filters out invalid entries and keeps valid ones", () => {
    const good = makeSession();
    const noSummary = { ...makeSession(), summary: undefined };
    const badExercise = { ...makeSession(), exercise: "deadlift" };
    const badNumber = { ...makeSession(), startedAt: "yesterday" };
    const badRepsType = makeSession();
    (badRepsType.summary as unknown as Record<string, unknown>).reps = "12";
    writeRaw([good, noSummary, badExercise, badNumber, badRepsType, null, 42, "x"]);
    const loaded = loadSessions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(good.id);
  });

  it("normalizes summaries (drops junk rep durations, strips extra fields)", () => {
    const s = makeSession();
    writeRaw([
      {
        ...s,
        extra: "nope",
        summary: { ...s.summary, repDurationsMs: [1000, "x", -5, Number.NaN, 2000], exercise: "pushup" },
      },
    ]);
    const [loaded] = loadSessions();
    expect(loaded.summary.repDurationsMs).toEqual([1000, 2000]);
    expect(loaded.summary.exercise).toBe("squat");
    expect("extra" in loaded).toBe(false);
  });

  it("sorts newest first and caps to the newest MAX_STORED_SESSIONS", () => {
    const many = Array.from({ length: MAX_STORED_SESSIONS + 20 }, (_, i) =>
      makeSession({ id: `cap-${i}`, startedAt: 1_000_000 + i * 1000 }),
    );
    writeRaw(many);
    const loaded = loadSessions();
    expect(loaded).toHaveLength(MAX_STORED_SESSIONS);
    expect(loaded[0].id).toBe(`cap-${MAX_STORED_SESSIONS + 19}`);
    expect(loaded.at(-1)?.id).toBe("cap-20");
  });

  it("returns a stable snapshot reference until the data changes", () => {
    writeRaw([makeSession()]);
    const a = loadSessions();
    const b = loadSessions();
    expect(b).toBe(a);
    saveSession(makeSession());
    const c = loadSessions();
    expect(c).not.toBe(a);
    expect(loadSessions()).toBe(c);
  });

  it("returns [] when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    reloadSessions();
    expect(loadSessions()).toEqual([]);
  });

  it("uses a constant empty server snapshot", () => {
    expect(getServerSnapshot()).toBe(getServerSnapshot());
    expect(getServerSnapshot()).toEqual([]);
  });
});

describe("saveSession / clearSessions / subscribe", () => {
  it("persists, notifies subscribers and replaces by id", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    const s = makeSession();
    expect(saveSession(s)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(SESSIONS_STORAGE_KEY) ?? "[]")).toHaveLength(1);

    saveSession({ ...s, goalMet: true });
    const loaded = loadSessions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].goalMet).toBe(true);
    unsubscribe();
  });

  it("throws on an invalid session", () => {
    expect(() => saveSession({ ...makeSession(), exercise: "deadlift" } as unknown as WorkoutSession)).toThrow(
      TypeError,
    );
  });

  it("keeps the session in memory and returns false when storage is full", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const s = makeSession();
    expect(saveSession(s)).toBe(false);
    expect(loadSessions().map((x) => x.id)).toEqual([s.id]);
  });

  it("clears storage and notifies", () => {
    saveSession(makeSession());
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    clearSessions();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(loadSessions()).toEqual([]);
    expect(localStorage.getItem(SESSIONS_STORAGE_KEY)).toBeNull();
    unsubscribe();
  });

  it("reloads on cross-tab storage events for its key only", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    const before = loadSessions();

    window.dispatchEvent(new StorageEvent("storage", { key: "something.else" }));
    expect(listener).not.toHaveBeenCalled();

    const other = makeSession();
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify([other]));
    window.dispatchEvent(new StorageEvent("storage", { key: SESSIONS_STORAGE_KEY }));
    expect(listener).toHaveBeenCalledTimes(1);
    const after = loadSessions();
    expect(after).not.toBe(before);
    expect(after.map((x) => x.id)).toEqual([other.id]);
    unsubscribe();

    // No longer notified after unsubscribing.
    window.dispatchEvent(new StorageEvent("storage", { key: SESSIONS_STORAGE_KEY }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("parseSession", () => {
  it("clamps endedAt to startedAt and confidence to 1", () => {
    const s = makeSession();
    const parsed = parseSession({
      ...s,
      endedAt: s.startedAt - 5,
      summary: { ...s.summary, avgTrackingConfidence: 3 },
    });
    expect(parsed?.endedAt).toBe(s.startedAt);
    expect(parsed?.summary.avgTrackingConfidence).toBe(1);
  });
});
