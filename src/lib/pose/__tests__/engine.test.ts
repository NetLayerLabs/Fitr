import { describe, expect, it } from "vitest";
import {
  createRepEngine,
  ENGINE_DEFAULTS,
  ISSUE_PRIORITY,
  PLANK_DEFAULTS,
  PUSHUP_DEFAULTS,
  resolveConfig,
  SQUAT_DEFAULTS,
} from "@/lib/pose/engine";
import { Debouncer, RepCycle, SideSelector, sortIssues } from "@/lib/pose/engine/common";
import { LANDMARK_COUNT, LM } from "@/lib/pose/landmarks";
import {
  plankSequence,
  pushupSequence,
  pushupTimeline,
  squatSequence,
  withDropout,
  withJitter,
  withTeleport,
} from "@/lib/pose/testing/synthetic";
import { EXERCISE_KINDS, type ExerciseKind, type FormIssue, type PoseFrame } from "@/lib/pose/types";
import { runFrames } from "./helpers";

/** A messy but realistic session for each exercise: jitter, a dropout and a glitch. */
function messySession(kind: ExerciseKind): PoseFrame[] {
  const base =
    kind === "pushup"
      ? pushupSequence({ reps: 6, jitterDeg: 4, seed: 21 })
      : kind === "squat"
        ? squatSequence({ reps: 6, jitterDeg: 4, seed: 22 })
        : plankSequence({ durationMs: 12_000, jitterDeg: 4, seed: 23, hipBendDeg: (t) => (t > 7000 && t < 8200 ? 30 : 0) });
  const noisy = withJitter(base, { amplitude: 0.003, seed: 5 });
  const t0 = noisy[0].timestampMs;
  return withTeleport(withDropout(noisy, t0 + 3000, t0 + 3700), t0 + 5000, { durationMs: 60 });
}

function garbageFrames(): unknown[] {
  const good = pushupSequence({ reps: 1 })[40];
  const nanLandmarks = good.landmarks.map((l) => ({ ...l, x: Number.NaN }));
  return [
    null,
    undefined,
    42,
    "frame",
    {},
    { timestampMs: Number.NaN, landmarks: good.landmarks, imageWidth: 640, imageHeight: 480 },
    { timestampMs: Infinity, landmarks: good.landmarks, imageWidth: 640, imageHeight: 480 },
    { timestampMs: 1, landmarks: null, imageWidth: 640, imageHeight: 480 },
    { timestampMs: 2, landmarks: "nope", imageWidth: 640, imageHeight: 480 },
    { timestampMs: 3, landmarks: good.landmarks.slice(0, 10), imageWidth: 640, imageHeight: 480 },
    { timestampMs: 4, landmarks: new Array(LANDMARK_COUNT).fill(null), imageWidth: 640, imageHeight: 480 },
    { timestampMs: 5, landmarks: new Array(LANDMARK_COUNT).fill(undefined), imageWidth: 640, imageHeight: 480 },
    { timestampMs: 6, landmarks: nanLandmarks, imageWidth: 640, imageHeight: 480 },
    {
      timestampMs: 7,
      landmarks: good.landmarks.map((l) => ({ ...l, visibility: Number.NaN })),
      imageWidth: 640,
      imageHeight: 480,
    },
    { timestampMs: 8, landmarks: good.landmarks, imageWidth: 0, imageHeight: 480 },
    { timestampMs: 9, landmarks: good.landmarks, imageWidth: 640, imageHeight: Number.NaN },
    { timestampMs: 10, landmarks: good.landmarks.map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })), imageWidth: 640, imageHeight: 480 },
    { timestampMs: 11, landmarks: good.landmarks.map(() => ({})), imageWidth: 640, imageHeight: 480 },
    { timestampMs: 12, landmarks: [...good.landmarks, { x: Infinity, y: -Infinity, z: 0, visibility: 2 }], imageWidth: 640, imageHeight: 480 },
    { timestampMs: 5, landmarks: good.landmarks, imageWidth: 640, imageHeight: 480 },
  ];
}

describe("createRepEngine", () => {
  it("creates an engine per kind with a searching initial state", () => {
    for (const kind of EXERCISE_KINDS) {
      const engine = createRepEngine(kind);
      expect(engine.exercise).toBe(kind);
      expect(engine.getState()).toEqual({
        exercise: kind,
        phase: "searching",
        reps: 0,
        rejectedReps: 0,
        holdMs: 0,
        primaryAngleDeg: null,
        bodyLineDeg: null,
        formIssues: [],
        trackingConfidence: 0,
        side: null,
      });
      expect(engine.summary()).toEqual({
        exercise: kind,
        reps: 0,
        rejectedReps: 0,
        holdMs: 0,
        repDurationsMs: [],
        activeMs: 0,
        framesProcessed: 0,
        framesWithPose: 0,
        avgTrackingConfidence: 0,
      });
    }
  });

  it("throws for an unknown kind (programming error, not a frame error)", () => {
    expect(() => createRepEngine("deadlift" as ExerciseKind)).toThrow();
  });

  it("applies overrides", () => {
    // With a 60 degree depth requirement, 70 degree push-ups become partial reps.
    const result = runFrames("pushup", pushupSequence({ reps: 3 }), { downAngleDeg: 60 });
    expect(result.final.reps).toBe(0);
    expect(result.final.rejectedReps).toBe(3);
  });

  it("resolveConfig merges overrides without touching the frozen defaults", () => {
    const cfg = resolveConfig("squat", { downAngleDeg: 100, angleFilter: { beta: 0.5 }, minRepMs: undefined });
    expect(cfg.downAngleDeg).toBe(100);
    expect(cfg.minRepMs).toBe(SQUAT_DEFAULTS.minRepMs);
    expect(cfg.angleFilter).toEqual({ ...SQUAT_DEFAULTS.angleFilter, beta: 0.5 });
    expect(SQUAT_DEFAULTS.downAngleDeg).toBe(95);
    expect(SQUAT_DEFAULTS.angleFilter.beta).toBe(0.02);
    expect(Object.isFrozen(PUSHUP_DEFAULTS)).toBe(true);
    expect(resolveConfig("plank")).toEqual(PLANK_DEFAULTS);
    expect(ENGINE_DEFAULTS.pushup).toBe(PUSHUP_DEFAULTS);
  });

  it("documented default thresholds", () => {
    expect(PUSHUP_DEFAULTS).toMatchObject({ upAngleDeg: 155, downAngleDeg: 90, minRepMs: 400, minBodyLineDeg: 150 });
    expect(SQUAT_DEFAULTS).toMatchObject({ upAngleDeg: 160, downAngleDeg: 95, minRepMs: 500 });
    expect(PLANK_DEFAULTS).toMatchObject({ minBodyLineDeg: 160, graceMs: 500, maxCreditPerFrameMs: 200 });
    expect(PUSHUP_DEFAULTS).toMatchObject({
      visibilityThreshold: 0.5,
      lostTimeoutMs: 300,
      teleportFraction: 0.25,
      glitchFreezeMs: 300,
      maxFrameGapMs: 500,
      debounceFrames: 2,
      debounceMs: 50,
    });
  });
});

describe("determinism and reset", () => {
  it.each(EXERCISE_KINDS)("%s: the same frames twice give deep-equal outputs", (kind) => {
    const frames = messySession(kind);
    const a = runFrames(kind, frames);
    const b = runFrames(kind, messySession(kind));
    expect(b.updates).toEqual(a.updates);
    expect(b.summary).toEqual(a.summary);
    expect(a.summary.framesProcessed).toBe(frames.length);
  });

  it.each(EXERCISE_KINDS)("%s: reset() restores the initial state and replays identically", (kind) => {
    const frames = messySession(kind);
    const fresh = createRepEngine(kind);
    const initialState = fresh.getState();
    const initialSummary = fresh.summary();
    const firstRun = frames.map((f) => fresh.update(f));
    expect(fresh.summary().framesProcessed).toBe(frames.length);

    fresh.reset();
    expect(fresh.getState()).toEqual(initialState);
    expect(fresh.summary()).toEqual(initialSummary);
    const secondRun = frames.map((f) => fresh.update(f));
    expect(secondRun).toEqual(firstRun);
  });

  it("synthetic sequences are reproducible from their seed", () => {
    expect(pushupSequence({ reps: 2, jitterDeg: 4, seed: 3 })).toEqual(pushupSequence({ reps: 2, jitterDeg: 4, seed: 3 }));
    expect(pushupSequence({ reps: 2, jitterDeg: 4, seed: 3 })).not.toEqual(
      pushupSequence({ reps: 2, jitterDeg: 4, seed: 4 }),
    );
  });
});

describe("robustness", () => {
  it.each(EXERCISE_KINDS)("%s: malformed frames never throw and are treated as no pose", (kind) => {
    const engine = createRepEngine(kind);
    for (const frame of garbageFrames()) {
      expect(() => engine.update(frame as PoseFrame)).not.toThrow();
      const state = engine.getState();
      expect(state.reps).toBe(0);
      expect(state.holdMs).toBe(0);
      expect(Number.isFinite(state.trackingConfidence)).toBe(true);
    }
    expect(() => engine.summary()).not.toThrow();
    expect(Number.isFinite(engine.summary().avgTrackingConfidence)).toBe(true);
  });

  it("still counts correctly after a burst of garbage", () => {
    const engine = createRepEngine("pushup");
    for (const frame of garbageFrames()) engine.update(frame as PoseFrame);
    for (const frame of pushupSequence({ reps: 4, startMs: 1000 })) engine.update(frame);
    expect(engine.getState().reps).toBe(4);
  });

  it("garbage interleaved with a clean set does not change the count", () => {
    const engine = createRepEngine("pushup");
    const frames = pushupSequence({ reps: 5 });
    frames.forEach((frame, i) => {
      engine.update(frame);
      if (i % 7 === 0) {
        engine.update({ ...frame, timestampMs: frame.timestampMs } as PoseFrame); // duplicate timestamp
        engine.update(null as unknown as PoseFrame);
        engine.update({ ...frame, timestampMs: Number.NaN });
      }
    });
    expect(engine.getState().reps).toBe(5);
  });

  it("ignores frames whose timestamp does not increase", () => {
    const engine = createRepEngine("pushup");
    const frames = pushupSequence({ reps: 2 });
    let lastTime = -Infinity;
    for (const frame of frames) {
      engine.update(frame);
      lastTime = frame.timestampMs;
      const again = engine.update({ ...frame, timestampMs: lastTime - 10 });
      expect(again.events).toEqual([]);
    }
    expect(engine.getState().reps).toBe(2);
    expect(engine.summary().framesProcessed).toBe(frames.length * 2);
  });

  it("getState() and update() return copies", () => {
    const engine = createRepEngine("pushup");
    const frames = pushupSequence({ reps: 1 });
    const update = engine.update(frames[0]);
    const snapshot = structuredClone(engine.getState());
    update.state.formIssues.push("too_fast");
    update.state.reps = 99;
    const state = engine.getState();
    state.formIssues.push("go_lower");
    state.phase = "down";
    expect(engine.getState()).toEqual(snapshot);
  });

  it("an empty session: body_not_visible only after 300 ms without a pose", () => {
    const engine = createRepEngine("squat");
    const issuesAt = (t: number) =>
      engine.update({ timestampMs: t, landmarks: [], imageWidth: 640, imageHeight: 480 }).state.formIssues;
    expect(issuesAt(1000)).toEqual([]);
    expect(issuesAt(1200)).toEqual([]);
    expect(issuesAt(1300)).toEqual(["body_not_visible"]);
    expect(engine.getState().phase).toBe("searching");
    expect(engine.summary().framesWithPose).toBe(0);
    expect(engine.summary().activeMs).toBe(0);
  });
});

describe("summary and tracking confidence", () => {
  it("accumulates frames, active time and confidence", () => {
    const frames = pushupSequence({ reps: 3 });
    const t0 = frames[0].timestampMs;
    const dropped = withDropout(frames, t0 + 500, t0 + 700);
    const result = runFrames("pushup", dropped);
    const s = result.summary;
    expect(s.exercise).toBe("pushup");
    expect(s.reps).toBe(3);
    expect(s.framesProcessed).toBe(frames.length);
    expect(s.framesWithPose).toBe(dropped.filter((f) => f.landmarks.length > 0).length);
    expect(s.activeMs).toBe(frames[frames.length - 1].timestampMs - t0);
    expect(s.avgTrackingConfidence).toBeCloseTo(0.98, 5);
    expect(s.repDurationsMs).toHaveLength(3);
  });

  it("trackingConfidence is the mean visibility of the tracked side's joints", () => {
    const frames = pushupSequence({
      reps: 1,
      nearVisibility: 0.9,
      visibility: { [LM.LEFT_ELBOW]: 0.6 },
    });
    const result = runFrames("pushup", frames);
    // shoulder, elbow, wrist, hip, knee, ankle => (0.9 * 5 + 0.6) / 6
    expect(result.final.trackingConfidence).toBeCloseTo(0.85, 5);
    expect(result.final.side).toBe("left");
  });

  it("reads the better side and does not flip between near-equal sides", () => {
    const base = pushupSequence({ reps: 3, nearVisibility: 0.8, farVisibility: 0.72 });
    // Alternate which side is slightly more visible every frame.
    const flicker = base.map((f, i) => ({
      ...f,
      landmarks: f.landmarks.map((l, idx) => {
        const isLeft = [11, 13, 15, 23, 25, 27].includes(idx);
        const isRight = [12, 14, 16, 24, 26, 28].includes(idx);
        if (!isLeft && !isRight) return l;
        const boost = (i % 2 === 0) === isLeft ? 0.1 : 0;
        return { ...l, visibility: 0.75 + boost };
      }),
    }));
    const result = runFrames("pushup", flicker);
    const sides = new Set(result.updates.map((u) => u.state.side).filter(Boolean));
    expect(sides.size).toBe(1);
    expect(result.final.reps).toBe(3);
  });

  it("switches sides when the tracked side becomes invisible", () => {
    const frames = pushupSequence({ reps: 3, nearVisibility: 0.95, farVisibility: 0.7 });
    const t0 = frames[0].timestampMs;
    const hideLeft = frames.map((f) =>
      f.timestampMs < t0 + 2500
        ? f
        : { ...f, landmarks: f.landmarks.map((l, idx) => ([11, 13, 15, 23, 25, 27].includes(idx) ? { ...l, visibility: 0.2 } : l)) },
    );
    const result = runFrames("pushup", hideLeft);
    expect(result.final.side).toBe("right");
    expect(result.final.reps).toBe(3);
  });
});

describe("issue ordering", () => {
  it("formIssues are unique and ordered by priority", () => {
    expect(sortIssues(["too_fast", "body_not_visible", "go_lower", "too_fast"])).toEqual([
      "body_not_visible",
      "go_lower",
      "too_fast",
    ]);
    expect(new Set(ISSUE_PRIORITY).size).toBe(ISSUE_PRIORITY.length);
  });

  it("ISSUE_PRIORITY ranks every FormIssue", () => {
    // Typed as an exhaustive Record so a new FormIssue fails type-checking until it is listed.
    const every: Record<FormIssue, true> = {
      body_not_visible: true,
      unstable_tracking: true,
      go_lower: true,
      extend_fully: true,
      hips_sagging: true,
      hips_piked: true,
      body_not_horizontal: true,
      body_on_floor: true,
      chest_up: true,
      too_fast: true,
      face_camera: true,
      turn_side_on: true,
      keep_back_on_wall: true,
      keep_hips_high: true,
      chin_over_bar: true,
      go_higher: true,
      arms_overhead: true,
      jump_higher: true,
    };
    expect([...ISSUE_PRIORITY].sort()).toEqual(Object.keys(every).sort());
  });

  it("a rejection keeps its issue visible for a while, then clears", () => {
    const timeline = pushupTimeline({ reps: [{ bottomAngle: 115 }], leadOutMs: 3000 });
    const result = runFrames("pushup", pushupSequence({ reps: [{ bottomAngle: 115 }], leadOutMs: 3000 }));
    const rejectedAt = result.events.find((e) => e.type === "rep_rejected")!.tMs;
    const withIssue = result.updates.filter((u) => u.state.formIssues.includes("go_lower"));
    expect(withIssue.length).toBeGreaterThan(10);
    expect(result.final.formIssues).toEqual([]);
    expect(rejectedAt).toBeLessThan(timeline.durationMs);
  });
});

describe("building blocks", () => {
  it("Debouncer needs >= N frames and >= M ms", () => {
    const d = new Debouncer(2, 50);
    expect(d.update(true, 0)).toBe(false);
    expect(d.update(true, 33)).toBe(false);
    expect(d.update(true, 66)).toBe(true);
    expect(d.update(false, 99)).toBe(false);
    expect(d.update(true, 200)).toBe(false);
    expect(d.update(true, 267)).toBe(true); // 15 fps: two frames 67 ms apart
    d.reset();
    expect(d.update(true, 300)).toBe(false);
  });

  it("SideSelector prefers usable sides and applies hysteresis", () => {
    const s = new SideSelector(0.15);
    expect(s.select({ score: 0.6, usable: true }, { score: 0.9, usable: false })).toBe("left");
    expect(s.select({ score: 0.6, usable: true }, { score: 0.7, usable: true })).toBe("left");
    expect(s.select({ score: 0.6, usable: true }, { score: 0.8, usable: true })).toBe("right");
    expect(s.select({ score: 0.7, usable: true }, { score: 0.6, usable: true })).toBe("right");
    expect(s.select({ score: 0.7, usable: true }, { score: 0.6, usable: false })).toBe("left");
  });

  it("RepCycle reports down, complete, partial and redip", () => {
    const c = new RepCycle({ upAngleDeg: 155, downAngleDeg: 90, partialAngleDeg: 135 });
    c.begin(0, 170);
    expect(c.step(100, 160, true, false).type).toBe("none");
    expect(c.step(400, 80, false, true).type).toBe("down");
    const done = c.step(900, 165, true, false);
    expect(done).toEqual({ type: "complete", durationMs: 800, minAngleDeg: 80, maxAngleDeg: 165 });
    expect(c.step(1000, 120, false, false).type).toBe("none");
    expect(c.step(1300, 160, true, false).type).toBe("partial");
    expect(c.step(1500, 80, false, true).type).toBe("down");
    expect(c.step(1700, 140, false, false).type).toBe("none");
    expect(c.step(1900, 80, false, true).type).toBe("redip");
    expect(c.step(2400, 170, true, false)).toMatchObject({ type: "complete", durationMs: 700 });
  });
});
