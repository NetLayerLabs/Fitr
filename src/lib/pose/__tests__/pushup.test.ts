import { describe, expect, it } from "vitest";
import { LM } from "@/lib/pose/landmarks";
import {
  keyframes,
  proneArmWaveSequence,
  pushupSequence,
  pushupTimeline,
  standingArmCurlSequence,
  withDropout,
  withGap,
  withJitter,
  withTeleport,
  type PushupSequenceOptions,
} from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { eventsOfType, rejectionReasons, repEvents, runFrames } from "./helpers";

function expectCleanSet(options: PushupSequenceOptions, reps = 5) {
  const result = runFrames("pushup", pushupSequence({ reps, ...options }));
  expect(result.final.reps).toBe(reps);
  expect(result.final.rejectedReps).toBe(0);
  expect(rejectionReasons(result)).toEqual([]);
  const repsSeen = repEvents(result);
  expect(repsSeen.map((e) => e.repIndex)).toEqual(Array.from({ length: reps }, (_, i) => i + 1));
  for (const rep of repsSeen) {
    expect(rep.durationMs).toBeGreaterThanOrEqual(400);
    expect(rep.minAngleDeg).toBeLessThan(90);
    expect(rep.maxAngleDeg).toBeGreaterThan(155);
  }
  expect(result.summary.repDurationsMs).toEqual(repsSeen.map((e) => e.durationMs));
  return result;
}

describe("push-up engine: clean sets", () => {
  it.each<[string, PushupSequenceOptions]>([
    ["30 fps landscape 640x480", {}],
    ["15 fps", { fps: 15 }],
    ["portrait 480x640", { width: 480, height: 640 }],
    ["portrait at 15 fps", { width: 480, height: 640, fps: 15 }],
    ["1080p landscape", { width: 1920, height: 1080 }],
    ["right side towards the camera", { nearSide: "right" }],
    ["mirrored (facing the other way)", { mirror: true }],
    ["large start timestamp", { startMs: 987654.5 }],
    ["slow 2.5 s reps", { repMs: 2500 }],
    ["1 s reps with no pause", { repMs: 1000, holdMs: 0 }],
  ])("counts exactly 5 reps (%s)", (_label, options) => {
    expectCleanSet(options);
  });

  it("goes searching -> ready -> down/up and ends at the top", () => {
    const result = expectCleanSet({}, 3);
    expect(result.phases).toEqual(["searching", "ready", "down", "up", "down", "up", "down", "up"]);
    expect(result.final.phase).toBe("up");
    expect(result.final.side).toBe("left");
    expect(result.final.formIssues).toEqual([]);
    expect(result.final.primaryAngleDeg).toBeGreaterThan(160);
    expect(result.final.bodyLineDeg).toBeGreaterThan(170);
  });

  it("stays exact with seeded +/-4 degree angle jitter at 30 and 15 fps", () => {
    for (let seed = 1; seed <= 12; seed++) {
      expectCleanSet({ jitterDeg: 4, seed });
      expectCleanSet({ jitterDeg: 4, seed, fps: 15 });
      expectCleanSet({ jitterDeg: 4, seed, width: 480, height: 640 });
    }
  });

  it("stays exact with positional landmark noise", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const frames = withJitter(pushupSequence({ reps: 5, jitterDeg: 3, seed }), { amplitude: 0.004, seed });
      const result = runFrames("pushup", frames);
      expect(result.final.reps).toBe(5);
      expect(result.final.rejectedReps).toBe(0);
    }
  });

  it("does not count with the feet out of frame (no shoulder-hip-knee fallback)", () => {
    // Without the ankles a knee push-up cannot be told apart from a real one, so nothing counts
    // and the user is asked to get their whole body in frame.
    const hidden = { [LM.LEFT_ANKLE]: 0.1, [LM.RIGHT_ANKLE]: 0.1 };
    const result = runFrames("pushup", pushupSequence({ reps: 5, visibility: hidden }));
    expect(result.final.reps).toBe(0);
    expect(result.final.rejectedReps).toBe(0);
    expect(result.phases).toEqual(["searching"]);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
  });

  it("stays exact with slightly soft knees (knee 170-180 degrees, jittered)", () => {
    for (let seed = 1; seed <= 8; seed++) {
      expectCleanSet({ kneeBendDeg: 5, jitterDeg: 4, seed });
      expectCleanSet({ kneeBendDeg: 5, jitterDeg: 4, seed, fps: 15, width: 480, height: 640 });
    }
  });

  it("does not count the first press when starting from the bottom", () => {
    // Start with bent arms, press up, then do 2 real reps.
    const profile = keyframes([
      [0, 70],
      [800, 70],
      [1400, 170],
      [2000, 170],
      [2600, 70],
      [3200, 170],
      [3700, 170],
      [4300, 70],
      [4900, 170],
      [5600, 170],
    ]);
    const result = runFrames("pushup", pushupSequence({ profile: { durationMs: 5600, angleAt: profile } }));
    expect(result.final.reps).toBe(2);
    expect(result.final.rejectedReps).toBe(0);
    expect(result.issuesSeen.has("extend_fully")).toBe(true);
  });
});

describe("push-up engine: rejected reps", () => {
  it("rejects partial reps with go_lower, once per attempt", () => {
    const result = runFrames("pushup", pushupSequence({ reps: 3, bottomAngle: 110 }));
    expect(result.final.reps).toBe(0);
    expect(result.final.rejectedReps).toBe(3);
    expect(rejectionReasons(result)).toEqual(["go_lower", "go_lower", "go_lower"]);
    expect(result.phases).not.toContain("down");
    expect(result.issuesSeen.has("go_lower")).toBe(true);
  });

  it("ignores shallow wobbles above the partial threshold entirely", () => {
    const result = runFrames("pushup", pushupSequence({ reps: 3, bottomAngle: 145 }));
    expect(result.final.reps).toBe(0);
    expect(result.final.rejectedReps).toBe(0);
  });

  it("mixes good and partial reps correctly", () => {
    const frames = pushupSequence({
      reps: [{}, { bottomAngle: 115 }, {}, { bottomAngle: 120 }, {}],
      jitterDeg: 3,
      seed: 9,
    });
    const result = runFrames("pushup", frames);
    expect(result.final.reps).toBe(3);
    expect(rejectionReasons(result)).toEqual(["go_lower", "go_lower"]);
  });

  it("rejects too-fast reps", () => {
    const result = runFrames("pushup", pushupSequence({ reps: 4, repMs: 260, bottomHoldMs: 60, holdMs: 250 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["too_fast", "too_fast", "too_fast", "too_fast"]);
    expect(result.issuesSeen.has("too_fast")).toBe(true);
  });

  it.each([
    ["hips_sagging", 40, false],
    ["hips_piked", -40, false],
    ["hips_sagging", 40, true],
    ["hips_piked", -40, true],
  ] as const)("rejects %s reps (bend %i, mirrored %s)", (issue, hipBendDeg, mirror) => {
    const result = runFrames("pushup", pushupSequence({ reps: 3, hipBendDeg, mirror }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual([issue, issue, issue]);
    expect(result.issuesSeen.has(issue)).toBe(true);
  });

  it("accepts a slightly imperfect body line (> 150 degrees)", () => {
    expectCleanSet({ hipBendDeg: 18 });
    expectCleanSet({ hipBendDeg: -18 });
  });

  it("re-dipping without locking out is rejected with extend_fully", () => {
    // Down to 70, up only to 140, down to 70 again, then a full lockout.
    const profile = keyframes([
      [0, 170],
      [1000, 170],
      [1600, 70],
      [2100, 140],
      [2600, 70],
      [3200, 170],
      [4000, 170],
    ]);
    const result = runFrames("pushup", pushupSequence({ profile: { durationMs: 4000, angleAt: profile } }));
    expect(rejectionReasons(result)).toEqual(["extend_fully"]);
    expect(result.final.reps).toBe(1);
    // The counted rep is timed from the top of the re-dip, not from the first descent.
    expect(repEvents(result)[0].durationMs).toBeLessThan(1400);
  });
});

describe("push-up engine: anti-cheat", () => {
  it("standing arm curls count 0 push-ups", () => {
    for (const options of [{}, { jitterDeg: 4, seed: 3 }, { width: 480, height: 640 }, { fps: 15 }]) {
      const result = runFrames("pushup", standingArmCurlSequence({ reps: 6, ...options }));
      expect(result.final.reps).toBe(0);
      expect(result.final.rejectedReps).toBe(0);
      expect(result.phases).toEqual(["searching"]);
      expect(result.final.formIssues).toContain("body_not_horizontal");
    }
  });

  it("lying on the floor bending the elbows counts 0 push-ups (wrists must be under the shoulders)", () => {
    for (const options of [{}, { jitterDeg: 4, seed: 8 }, { width: 480, height: 640 }]) {
      const result = runFrames("pushup", proneArmWaveSequence({ reps: 5, ...options }));
      expect(result.final.reps).toBe(0);
      expect(result.final.rejectedReps).toBe(0);
      expect(result.phases).toEqual(["searching"]);
    }
    // Two independent guards block this cheat: the wrist must be under the shoulder, and the
    // hands must stay planted during a rep (here they move instead of the body). Either one is
    // enough; without both it would count.
    const prone = proneArmWaveSequence({ reps: 5 });
    expect(runFrames("pushup", prone, { maxArmFromVerticalDeg: 180 }).final.reps).toBe(0);
    expect(runFrames("pushup", prone, { maxWristDriftRatio: 100 }).final.reps).toBe(0);
    const unguarded = runFrames("pushup", prone, { maxArmFromVerticalDeg: 180, maxWristDriftRatio: 100 });
    expect(unguarded.final.reps).toBe(5);
    const shown = runFrames("pushup", prone);
    expect(shown.issuesSeen.has("body_on_floor")).toBe(true);
  });

  it("dropping to the knees mid-rep rejects that rep with body_on_floor", () => {
    const reps = [{}, {}, {}, {}, {}];
    const timeline = pushupTimeline({ reps });
    const third = timeline.reps[2];
    // During the third rep the knees drop to the floor (knee 145 degrees), then straighten again
    // before the lockout.
    const kneeBendDeg = (t: number) => (t > third.startMs + 200 && t < third.endMs - 250 ? 35 : 0);
    const result = runFrames("pushup", pushupSequence({ reps, kneeBendDeg }));
    expect(result.final.reps).toBe(4);
    expect(rejectionReasons(result)).toEqual(["body_on_floor"]);
    expect(result.issuesSeen.has("body_on_floor")).toBe(true);
  });

  it("a set never starts from the knees", () => {
    const result = runFrames("pushup", pushupSequence({ reps: 5, kneeBendDeg: 35 }));
    expect(result.final.reps).toBe(0);
    expect(result.final.rejectedReps).toBe(0);
    expect(result.phases).toEqual(["searching"]);
    expect(result.final.formIssues).toContain("body_on_floor");
  });

  it("getting up mid-rep cancels the attempt; the set resumes after a new lockout", () => {
    const concat = (...parts: PoseFrame[][]) => {
      const out: PoseFrame[] = [];
      let offset = 0;
      for (const part of parts) {
        const base = part[0].timestampMs;
        for (const f of part) out.push({ ...f, timestampMs: offset + (f.timestampMs - base) });
        offset = out[out.length - 1].timestampMs + 33;
      }
      return out;
    };
    // One full rep, then down to the bottom and stay there...
    const firstPart = pushupSequence({
      profile: {
        durationMs: 3200,
        angleAt: keyframes([
          [0, 170],
          [1000, 170],
          [1600, 70],
          [2200, 170],
          [2500, 170],
          [3000, 70],
        ]),
      },
    });
    // ...then stand up (arms moving), then two more push-ups.
    const frames = concat(firstPart, standingArmCurlSequence({ reps: 1 }), pushupSequence({ reps: 2 }));
    const result = runFrames("pushup", frames);
    expect(result.final.reps).toBe(3);
    expect(result.final.rejectedReps).toBe(0);
    expect(result.issuesSeen.has("body_not_horizontal")).toBe(true);
    expect(result.phases).toEqual([
      "searching",
      "ready",
      "down",
      "up",
      "down",
      "searching",
      "ready",
      "down",
      "up",
      "down",
      "up",
    ]);
  });

  it("a teleport glitch at the top does not create or reject a rep", () => {
    const timeline = pushupTimeline({ reps: 5 });
    const at = timeline.reps[1].endMs + 100;
    for (const durationMs of [0, 100]) {
      const frames = withTeleport(pushupSequence({ reps: 5 }), at, { durationMs });
      const result = runFrames("pushup", frames);
      expect(result.final.reps).toBe(5);
      expect(result.final.rejectedReps).toBe(0);
      expect(result.issuesSeen.has("unstable_tracking")).toBe(true);
    }
  });

  it("the glitch guard is what prevents the bogus rep attempt", () => {
    const timeline = pushupTimeline({ reps: 5 });
    const frames = withTeleport(pushupSequence({ reps: 5 }), timeline.reps[1].endMs + 100, { durationMs: 100 });
    const unguarded = runFrames("pushup", frames, { teleportFraction: 100 });
    expect(unguarded.final.reps + unguarded.final.rejectedReps).toBeGreaterThan(5);
  });

  it("a teleport glitch mid-rep does not add reps", () => {
    const timeline = pushupTimeline({ reps: 5 });
    for (const window of timeline.reps) {
      for (const at of [window.startMs + 200, window.bottomStartMs - 50, window.endMs - 150]) {
        const frames = withTeleport(pushupSequence({ reps: 5 }), at, {
          durationMs: 70,
          joints: [LM.LEFT_WRIST, LM.LEFT_ELBOW, LM.RIGHT_WRIST, LM.RIGHT_ELBOW],
          dx: -0.35,
          dy: 0.1,
        });
        const result = runFrames("pushup", frames);
        expect(result.final.reps).toBeLessThanOrEqual(5);
        expect(result.final.reps).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("whole-frame jumps (camera shake) cannot mint reps", () => {
    const frames = pushupSequence({ reps: 0, leadInMs: 4000 });
    const shaken = frames.map((f, i) => {
      const dx = (i % 2 === 0 ? 1 : -1) * 0.2;
      const dy = (i % 3 === 0 ? 1 : -1) * 0.15;
      return { ...f, landmarks: f.landmarks.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy })) };
    });
    const result = runFrames("pushup", shaken);
    expect(result.final.reps).toBe(0);
    expect(result.final.rejectedReps).toBe(0);
  });
});

describe("push-up engine: tracking loss", () => {
  it("a dropout between reps goes to searching, then recovers with an exact count", () => {
    const reps = [{}, { holdMs: 1600 }, {}, {}];
    const timeline = pushupTimeline({ reps });
    const from = timeline.reps[1].endMs + 300;
    for (const mode of ["empty", "lowVisibility"] as const) {
      const frames = withDropout(pushupSequence({ reps }), from, from + 800, mode);
      const result = runFrames("pushup", frames);
      expect(result.final.reps).toBe(4);
      expect(result.final.rejectedReps).toBe(0);
      expect(result.issuesSeen.has("body_not_visible")).toBe(true);
      const searchingAt = result.phases.indexOf("searching", 1);
      expect(searchingAt).toBeGreaterThan(0);
      expect(result.phases[searchingAt + 1]).toBe("ready");
      // While lost, the state reports no side and no angles.
      const lost = result.updates.find((u) => u.state.formIssues.includes("body_not_visible"))!;
      expect(lost.state.side).toBeNull();
      expect(lost.state.primaryAngleDeg).toBeNull();
      expect(lost.state.trackingConfidence).toBeLessThan(0.5);
    }
  });

  it("a dropout across the bottom of a rep loses that rep and adds no phantom", () => {
    const timeline = pushupTimeline({ reps: 5 });
    const bottom = timeline.reps[2].bottomStartMs;
    const frames = withDropout(pushupSequence({ reps: 5 }), bottom - 200, bottom + 400);
    const result = runFrames("pushup", frames);
    expect(result.final.reps).toBe(4);
    expect(result.final.rejectedReps).toBe(0);
    expect(result.phases).toContain("searching");
  });

  it("a brief (< 300 ms) dropout does not interrupt the set", () => {
    const timeline = pushupTimeline({ reps: 5 });
    const bottom = timeline.reps[2].bottomStartMs;
    const frames = withDropout(pushupSequence({ reps: 5 }), bottom - 100, bottom + 100);
    const result = runFrames("pushup", frames);
    expect(result.final.reps).toBe(5);
    expect(result.phases.filter((p) => p === "searching")).toHaveLength(1);
    expect(result.issuesSeen.has("body_not_visible")).toBe(false);
  });

  it("a frame gap > 500 ms mid-rep cancels that rep", () => {
    const timeline = pushupTimeline({ reps: 5 });
    const bottom = timeline.reps[2].bottomStartMs;
    const result = runFrames("pushup", withGap(pushupSequence({ reps: 5 }), bottom - 300, bottom + 400));
    expect(result.final.reps).toBe(4);
    expect(result.final.rejectedReps).toBe(0);
  });

  it("a short frame gap (< 500 ms) during the descent is tolerated", () => {
    const timeline = pushupTimeline({ reps: 5 });
    const start = timeline.reps[2].startMs;
    const result = runFrames("pushup", withGap(pushupSequence({ reps: 5 }), start + 50, start + 400));
    expect(result.final.reps).toBe(5);
    expect(result.phases.filter((p) => p === "searching")).toHaveLength(1);
  });

  it("depth that is never observed (frames missing at the bottom) is not counted", () => {
    const timeline = pushupTimeline({ reps: 5 });
    const bottom = timeline.reps[2].bottomStartMs;
    const result = runFrames("pushup", withGap(pushupSequence({ reps: 5 }), bottom - 150, bottom + 150));
    expect(result.final.reps).toBe(4);
  });

  it("emits a phase event for every phase change", () => {
    const result = runFrames("pushup", pushupSequence({ reps: 2 }));
    const phaseEvents = eventsOfType(result, "phase");
    expect(phaseEvents.map((e) => e.to)).toEqual(result.phases.slice(1));
    for (let i = 1; i < phaseEvents.length; i++) {
      expect(phaseEvents[i].from).toBe(phaseEvents[i - 1].to);
      expect(phaseEvents[i].tMs).toBeGreaterThanOrEqual(phaseEvents[i - 1].tMs);
    }
  });
});
