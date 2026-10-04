import { describe, expect, it } from "vitest";
import { rejectionReasons, repEvents, runFrames } from "@/lib/pose/__tests__/helpers";
import { LM } from "@/lib/pose/landmarks";
import {
  seatedKneeExtensionSequence,
  squatSequence,
  withDropout,
  withJitter,
  withTeleport,
} from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { createEngine, demo } from "..";
import { JUMP_SQUAT_DEFAULTS } from "../config";
import { jumpSquatSequence, type JumpSquatSequenceOptions } from "../synthetic";

function expectClean(options: JumpSquatSequenceOptions, reps = 4) {
  const result = runFrames("jump_squat", jumpSquatSequence({ reps, ...options }));
  expect(result.final.reps).toBe(reps);
  expect(result.final.rejectedReps).toBe(0);
  const seen = repEvents(result);
  expect(seen.map((e) => e.repIndex)).toEqual(Array.from({ length: reps }, (_, i) => i + 1));
  for (const rep of seen) {
    expect(rep.durationMs).toBeGreaterThanOrEqual(JUMP_SQUAT_DEFAULTS.minRepMs);
    expect(rep.minAngleDeg).toBeLessThan(JUMP_SQUAT_DEFAULTS.downAngleDeg);
    expect(rep.maxAngleDeg).toBeGreaterThan(JUMP_SQUAT_DEFAULTS.upAngleDeg);
  }
  return result;
}

/** Hide both toes (foot index landmarks). */
const NO_TOES = { [LM.LEFT_FOOT_INDEX]: 0.05, [LM.RIGHT_FOOT_INDEX]: 0.05 };

describe("jump squat engine: clean sets", () => {
  it.each<[string, JumpSquatSequenceOptions]>([
    ["30 fps", {}],
    ["15 fps", { fps: 15 }],
    ["landing straight into the next squat", { standBetween: false }],
    ["landing straight into the next squat at 15 fps", { standBetween: false, fps: 15 }],
    ["right side towards the camera", { nearSide: "right" }],
    ["mirrored", { mirror: true }],
    ["portrait 480x640", { width: 480, height: 640 }],
    ["portrait at 15 fps", { width: 480, height: 640, fps: 15 }],
    ["toes not visible", { visibility: NO_TOES }],
  ])("counts every jump squat exactly (%s)", (_label, options) => {
    expectClean(options);
  });

  it("goes searching -> ready -> down/up", () => {
    const result = expectClean({}, 2);
    expect(result.phases).toEqual(["searching", "ready", "down", "up", "down", "up"]);
  });

  it("stays exact with seeded +/-4 degree jitter at 30 and 15 fps", () => {
    for (let seed = 1; seed <= 12; seed++) {
      expectClean({ jitterDeg: 4, seed });
      expectClean({ jitterDeg: 4, seed, fps: 15 });
      expectClean({ jitterDeg: 4, seed, standBetween: false });
    }
  });

  it("stays exact with positional landmark noise", () => {
    const frames = withJitter(jumpSquatSequence({ reps: 4, jitterDeg: 3, seed: 5 }), { amplitude: 0.003, seed: 5 });
    expect(runFrames("jump_squat", frames).final.reps).toBe(4);
  });

  it("counts the form-guide demo loop as exactly one rep", () => {
    const result = runFrames("jump_squat", demo.frames());
    expect(result.final.reps).toBe(1);
    expect(result.final.rejectedReps).toBe(0);
  });
});

describe("jump squat engine: rejected reps and cheats", () => {
  it("rejects half squats (with a jump) as go_lower", () => {
    const result = runFrames("jump_squat", jumpSquatSequence({ reps: 4, bottomKnee: 120 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["go_lower", "go_lower", "go_lower", "go_lower"]);
  });

  it("rejects reps faster than minRepMs as too_fast", () => {
    // With a realistic flight time (it follows from the jump height) a full squat + jump
    // cannot get under the 600 ms default, so fast-but-real reps count...
    const fast = jumpSquatSequence({ reps: [{ speed: 0.3 }, { speed: 0.3 }] });
    const ok = runFrames("jump_squat", fast);
    expect(ok.final.reps).toBe(2);
    expect(repEvents(ok).every((r) => r.durationMs < 900)).toBe(true);
    // ...and the same reps are rejected once they fall under the configured minimum.
    const strict = runFrames("jump_squat", fast, { minRepMs: 900 });
    expect(strict.final.reps).toBe(0);
    expect(rejectionReasons(strict)).toEqual(["too_fast", "too_fast"]);
  });

  it.each<[string, PoseFrame[]]>([
    ["plain squats (shared squat generator)", squatSequence({ reps: 5 })],
    ["squats without a jump", jumpSquatSequence({ reps: 4, jumpHeight: 0 })],
    ["squats without a jump, never standing in between", jumpSquatSequence({ reps: 4, jumpHeight: 0, standBetween: false })],
    ["a tiny hop", jumpSquatSequence({ reps: 4, jumpHeight: 0.035 })],
    ["rising onto the toes (calf raise)", jumpSquatSequence({ reps: 4, calfRaise: true })],
    ["an exaggerated calf raise, toes visible", jumpSquatSequence({ reps: 4, calfRaise: true, calfLift: 0.09 })],
    ["a calf raise with the toes hidden", jumpSquatSequence({ reps: 4, calfRaise: true, visibility: NO_TOES })],
  ])("counts 0 and asks for a jump: %s", (_label, frames) => {
    const result = runFrames("jump_squat", frames);
    expect(result.final.reps).toBe(0);
    expect(result.final.rejectedReps).toBeGreaterThan(0);
    expect(new Set(rejectionReasons(result))).toEqual(new Set(["jump_higher"]));
    expect(result.issuesSeen.has("jump_higher")).toBe(true);
  });

  it("does not count seated knee extensions", () => {
    expect(runFrames("jump_squat", seatedKneeExtensionSequence({})).final.reps).toBe(0);
  });

  it("does not count hopping without squatting", () => {
    const result = runFrames("jump_squat", jumpSquatSequence({ reps: 4, bottomKnee: 158 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["go_lower", "go_lower", "go_lower", "go_lower"]);
  });
});

describe("jump squat engine: tracking", () => {
  it("abandons a rep when tracking drops in flight, then recovers without phantom reps", () => {
    // Rep 2 (of 4, 2.38 s per rep after a 0.9 s lead-in) is in the air around 4.3 s.
    const frames = withDropout(jumpSquatSequence({ reps: 4 }), 4150, 4700);
    const result = runFrames("jump_squat", frames);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
    const iSearch = result.phases.lastIndexOf("searching");
    expect(iSearch).toBeGreaterThan(1);
    expect(result.phases.slice(iSearch)).toContain("ready");
    expect(result.final.reps).toBe(3);
  });

  it("flags a single-frame glitch and does not invent reps", () => {
    const frames = withTeleport(jumpSquatSequence({ reps: 4 }), 4300, {
      joints: [LM.LEFT_ANKLE, LM.LEFT_KNEE, LM.LEFT_HIP],
      dy: -0.3,
      dx: 0,
    });
    const result = runFrames("jump_squat", frames);
    expect(result.issuesSeen.has("unstable_tracking")).toBe(true);
    expect(result.final.reps).toBeLessThanOrEqual(4);
    expect(result.final.reps).toBeGreaterThanOrEqual(3);
  });
});

describe("jump squat engine: determinism and robustness", () => {
  it("gives deep-equal output for the same frames, and reset() replays identically", () => {
    const frames = withJitter(jumpSquatSequence({ reps: 3, jitterDeg: 4, seed: 9 }), { amplitude: 0.003, seed: 2 });
    const a = runFrames("jump_squat", frames);
    const b = runFrames("jump_squat", frames);
    expect(b.updates).toEqual(a.updates);
    const engine = createEngine();
    const first = frames.map((f) => engine.update(f));
    const s1 = engine.summary();
    engine.reset();
    expect(frames.map((f) => engine.update(f))).toEqual(first);
    expect(engine.summary()).toEqual(s1);
  });

  it("never throws on malformed frames and still counts the good ones", () => {
    const good = jumpSquatSequence({ reps: 2 });
    const junk = [
      null,
      {},
      { timestampMs: 1, landmarks: null, imageWidth: 640, imageHeight: 480 },
      { timestampMs: 2, landmarks: new Array(33).fill(null), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 3, landmarks: good[0].landmarks, imageWidth: 0, imageHeight: 0 },
      {
        timestampMs: 4,
        landmarks: good[0].landmarks.map((l) => ({ ...l, y: Number.POSITIVE_INFINITY })),
        imageWidth: 640,
        imageHeight: 480,
      },
      { timestampMs: 5, landmarks: good[0].landmarks.map(() => ({})), imageWidth: 640, imageHeight: 480 },
    ] as unknown as PoseFrame[];
    const engine = createEngine();
    for (const f of junk) expect(() => engine.update(f)).not.toThrow();
    for (const f of good) engine.update({ ...f, timestampMs: f.timestampMs + 100 });
    expect(engine.getState().reps).toBe(2);
  });
});
