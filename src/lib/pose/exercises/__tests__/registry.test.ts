import { describe, expect, it } from "vitest";
import { createRepEngine, ENGINE_DEFAULTS } from "@/lib/pose/engine";
import { EXERCISE_MODULES, exerciseModule } from "@/lib/pose/exercises/registry";
import { StubEngine } from "@/lib/pose/exercises/stub";
import { LANDMARK_COUNT } from "@/lib/pose/landmarks";
import { pushupSequence, squatSequence } from "@/lib/pose/testing/synthetic";
import { EXERCISE_KINDS, type ExerciseKind } from "@/lib/pose/types";

describe("exercise registry", () => {
  it("has a module, engine defaults and a working engine for every kind", () => {
    expect(Object.keys(EXERCISE_MODULES).sort()).toEqual([...EXERCISE_KINDS].sort());
    for (const kind of EXERCISE_KINDS) {
      expect(ENGINE_DEFAULTS[kind]).toBeDefined();
      const engine = createRepEngine(kind);
      expect(engine.exercise).toBe(kind);
      expect(engine.getState().phase).toBe("searching");
    }
  });

  it("does not resolve prototype keys or unknown kinds", () => {
    expect(exerciseModule("toString" as ExerciseKind)).toBeNull();
    expect(exerciseModule("deadlift" as ExerciseKind)).toBeNull();
    expect(() => createRepEngine("constructor" as ExerciseKind)).toThrow();
  });

  it("every demo renders 33-landmark frames, and judged angles name real joints", () => {
    for (const kind of EXERCISE_KINDS) {
      const { demo } = EXERCISE_MODULES[kind];
      const frames = demo.frames();
      expect(frames.length).toBeGreaterThan(30);
      expect(demo.frames()).toBe(frames); // cached
      for (const f of frames) expect(f.landmarks).toHaveLength(LANDMARK_COUNT);
      expect(["floor", "standing"]).toContain(demo.layout);
      if (demo.judged) {
        for (const j of demo.judged.joints) expect(j >= 0 && j < LANDMARK_COUNT).toBe(true);
        expect(demo.judged.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("stub engine", () => {
  it("never counts, stays searching, but keeps honest frame stats", () => {
    const engine = new StubEngine("burpee");
    const frames = [...squatSequence({ reps: 3 }), ...pushupSequence({ reps: 3, startMs: 10_000 })];
    for (const f of frames) {
      const { state, events } = engine.update(f);
      expect(state.phase).toBe("searching");
      expect(state.reps).toBe(0);
      expect(events).toEqual([]);
    }
    engine.update({ timestampMs: 99_999, landmarks: [], imageWidth: 640, imageHeight: 480 });
    const s = engine.summary();
    expect(s).toMatchObject({ exercise: "burpee", reps: 0, holdMs: 0, rejectedReps: 0, avgTrackingConfidence: 0 });
    expect(s.framesProcessed).toBe(frames.length + 1);
    expect(s.framesWithPose).toBe(frames.length);
    expect(s.activeMs).toBe(frames[frames.length - 1].timestampMs - frames[0].timestampMs);
    engine.reset();
    expect(engine.summary()).toMatchObject({ framesProcessed: 0, framesWithPose: 0, activeMs: 0 });
  });
});
