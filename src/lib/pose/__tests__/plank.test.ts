import { describe, expect, it } from "vitest";
import { LM } from "@/lib/pose/landmarks";
import {
  plankSequence,
  squatSequence,
  withDropout,
  withGap,
  withJitter,
  withTeleport,
  type PlankSequenceOptions,
} from "@/lib/pose/testing/synthetic";
import { eventsOfType, runFrames } from "./helpers";

function hold(options: Partial<PlankSequenceOptions> = {}) {
  return plankSequence({ durationMs: 10_000, ...options });
}

describe("plank engine: clean holds", () => {
  it.each<[string, Partial<PlankSequenceOptions>]>([
    ["forearm, 30 fps", {}],
    ["forearm, 15 fps", { fps: 15 }],
    ["forearm, portrait 480x640", { width: 480, height: 640 }],
    ["straight-arm, 30 fps", { style: "straight" }],
    ["straight-arm, portrait at 15 fps", { style: "straight", width: 480, height: 640, fps: 15 }],
    ["right side towards the camera", { nearSide: "right" }],
    ["mirrored", { mirror: true }],
    ["+/-4 degree jitter", { jitterDeg: 4, seed: 11 }],
    ["+/-4 degree jitter at 15 fps", { jitterDeg: 4, seed: 12, fps: 15 }],
  ])("a straight 10 s hold credits 10 000 ms within one frame (%s)", (_label, options) => {
    const fps = options.fps ?? 30;
    const result = runFrames("plank", hold(options));
    expect(Math.abs(result.final.holdMs - 10_000)).toBeLessThanOrEqual(1000 / fps);
    expect(result.final.phase).toBe("holding");
    expect(result.phases).toEqual(["searching", "holding"]);
    expect(eventsOfType(result, "hold_start")).toHaveLength(1);
    expect(eventsOfType(result, "hold_pause")).toHaveLength(0);
    expect(result.final.reps).toBe(0);
    expect(result.final.formIssues).toEqual([]);
    expect(result.summary.holdMs).toBe(result.final.holdMs);
  });

  it("stays within one frame across many jitter seeds and positional noise", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const frames = withJitter(hold({ jitterDeg: 4, seed }), { amplitude: 0.003, seed });
      const result = runFrames("plank", frames);
      expect(Math.abs(result.final.holdMs - 10_000)).toBeLessThanOrEqual(34);
      expect(eventsOfType(result, "hold_pause")).toHaveLength(0);
    }
  });

  it("reports the body line as the primary angle", () => {
    const result = runFrames("plank", hold());
    expect(result.final.primaryAngleDeg).toBeGreaterThan(175);
    expect(result.final.bodyLineDeg).toBe(result.final.primaryAngleDeg);
  });

  it("credits nothing with the feet out of frame (no shoulder-hip-knee fallback)", () => {
    // Without the ankles a knee plank cannot be told apart from a real one.
    const result = runFrames("plank", hold({ visibility: { [LM.LEFT_ANKLE]: 0.1, [LM.RIGHT_ANKLE]: 0.1 } }));
    expect(result.final.holdMs).toBe(0);
    expect(result.phases).toEqual(["searching"]);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
  });

  it("slightly soft knees (knee 170-180 degrees, +/-4 degree jitter) still credit the full hold", () => {
    for (let seed = 1; seed <= 8; seed++) {
      for (const style of ["forearm", "straight"] as const) {
        const result = runFrames("plank", hold({ style, kneeBendDeg: 5, jitterDeg: 4, seed }));
        expect(Math.abs(result.final.holdMs - 10_000), `${style} seed ${seed}`).toBeLessThanOrEqual(34);
        expect(eventsOfType(result, "hold_pause")).toHaveLength(0);
      }
    }
  });

  it("credits a slow device's frames in full (2.5, 3, 4 and 5 fps)", () => {
    for (const fps of [2.5, 3, 4, 5]) {
      const result = runFrames("plank", plankSequence({ durationMs: 20_000, fps }));
      expect(Math.abs(result.final.holdMs - 20_000), `${fps} fps`).toBeLessThanOrEqual(1000 / fps);
      expect(eventsOfType(result, "hold_pause")).toHaveLength(0);
    }
  });
});

describe("plank engine: form breaks", () => {
  it("sagging hips pause the timer with hips_sagging, then it restarts", () => {
    const frames = plankSequence({ durationMs: 9000, hipBendDeg: (t) => (t > 3000 && t < 6000 ? 30 : 0) });
    const result = runFrames("plank", frames);
    const pauses = eventsOfType(result, "hold_pause");
    expect(pauses.map((e) => e.reason)).toEqual(["hips_sagging"]);
    expect(pauses[0].tMs).toBeGreaterThan(3500);
    expect(pauses[0].tMs).toBeLessThan(3700);
    expect(eventsOfType(result, "hold_start")).toHaveLength(2);
    expect(result.phases).toEqual(["searching", "holding", "paused", "holding"]);
    expect(result.issuesSeen.has("hips_sagging")).toBe(true);
    // ~3 s before the break and ~3 s after it; the break itself is not credited.
    expect(result.final.holdMs).toBeGreaterThan(5900);
    expect(result.final.holdMs).toBeLessThan(6150);
  });

  it("piked hips pause with hips_piked", () => {
    const frames = plankSequence({ durationMs: 6000, hipBendDeg: (t) => (t > 3000 ? -30 : 0) });
    const result = runFrames("plank", frames);
    expect(eventsOfType(result, "hold_pause").map((e) => e.reason)).toEqual(["hips_piked"]);
    expect(result.final.phase).toBe("paused");
  });

  it.each([
    [450, 600],
    [400, 500],
    [200, 400],
    [300, 600],
  ])("rhythmic dips out of form (%i ms bad of every %i ms) are not credited as a hold", (bad, period) => {
    const frames = plankSequence({ durationMs: 20_000, hipBendDeg: (t) => (t % period < bad ? 30 : 0) });
    const result = runFrames("plank", frames);
    // At most the time actually spent in good form (plus slack) may be credited.
    expect(result.final.holdMs).toBeLessThan(0.5 * 20_000);
    expect(result.final.holdMs).toBeLessThanOrEqual(((period - bad) / period) * 20_000);
    expect(result.issuesSeen.has("hips_sagging")).toBe(true);
  });

  it("a wobble right before the end of the session is not credited (not yet forgiven)", () => {
    const frames = hold({ hipBendDeg: (t) => (t >= 9500 && t < 9800 ? 30 : 0) });
    const result = runFrames("plank", frames);
    expect(eventsOfType(result, "hold_pause")).toHaveLength(0);
    // 0 -> 9467 credited; the 300 ms wobble and the 200 ms after it are provisional.
    expect(result.final.holdMs).toBeGreaterThan(9467 - 34);
    expect(result.final.holdMs).toBeLessThan(9800);
  });

  it("a sub-grace form wobble (< 500 ms) does not pause and is credited", () => {
    const frames = hold({ hipBendDeg: (t) => (t >= 5000 && t < 5300 ? 30 : 0) });
    const result = runFrames("plank", frames);
    expect(eventsOfType(result, "hold_pause")).toHaveLength(0);
    expect(Math.abs(result.final.holdMs - 10_000)).toBeLessThanOrEqual(34);
    expect(result.issuesSeen.has("hips_sagging")).toBe(true);
  });

  it("a 200 ms dropout does not pause and its time is credited", () => {
    const result = runFrames("plank", withDropout(hold(), 5000, 5200));
    expect(eventsOfType(result, "hold_pause")).toHaveLength(0);
    expect(result.final.phase).toBe("holding");
    expect(Math.abs(result.final.holdMs - 10_000)).toBeLessThanOrEqual(34);
  });

  it("a 1 s dropout pauses with body_not_visible and drops the lost time", () => {
    for (const mode of ["empty", "lowVisibility"] as const) {
      const result = runFrames("plank", withDropout(hold(), 5000, 6000, mode));
      const pauses = eventsOfType(result, "hold_pause");
      expect(pauses.map((e) => e.reason)).toEqual(["body_not_visible"]);
      expect(pauses[0].tMs).toBeGreaterThanOrEqual(5467);
      expect(pauses[0].tMs).toBeLessThanOrEqual(5534);
      expect(eventsOfType(result, "hold_start")).toHaveLength(2);
      expect(result.phases).toEqual(["searching", "holding", "paused", "holding"]);
      // Credited: 0 -> 4967 and 6000 -> 10000.
      expect(Math.abs(result.final.holdMs - 8967)).toBeLessThanOrEqual(34);
    }
  });

  it("stays paused (not searching) while tracking is lost after a hold", () => {
    const result = runFrames("plank", withDropout(hold(), 5000, 20_000));
    expect(result.final.phase).toBe("paused");
    expect(result.final.formIssues).toContain("body_not_visible");
    expect(result.final.primaryAngleDeg).toBeNull();
  });

  it("a stalled camera cannot inflate the hold (per-frame credit is capped)", () => {
    const result = runFrames("plank", withGap(hold(), 3000, 7000));
    // Frames: 0 -> 2967 and 7000 -> 10000; the 4 s stall may add at most 200 ms.
    expect(result.final.holdMs).toBeLessThanOrEqual(2967 + 3000 + 200);
    expect(result.final.holdMs).toBeGreaterThanOrEqual(2967 + 3000);
  });

  it("a tracking glitch does not pause the hold", () => {
    const frames = withTeleport(hold(), 5000, { joints: [LM.LEFT_HIP, LM.RIGHT_HIP], dy: -0.3, dx: 0 });
    const result = runFrames("plank", frames);
    expect(eventsOfType(result, "hold_pause")).toHaveLength(0);
    expect(result.issuesSeen.has("unstable_tracking")).toBe(true);
    expect(Math.abs(result.final.holdMs - 10_000)).toBeLessThanOrEqual(34);
  });
});

describe("plank engine: anti-cheat", () => {
  it("lying flat on the floor is not a plank", () => {
    const result = runFrames("plank", plankSequence({ durationMs: 5000, style: "prone" }));
    expect(result.final.holdMs).toBe(0);
    expect(result.phases).toEqual(["searching"]);
    expect(result.issuesSeen.has("body_on_floor")).toBe(true);
    expect(result.issuesSeen.has("hips_sagging")).toBe(false);
  });

  it("a plank on the knees is not a plank (body_on_floor)", () => {
    for (const style of ["forearm", "straight"] as const) {
      const result = runFrames("plank", plankSequence({ durationMs: 5000, style, kneeBendDeg: 25 }));
      expect(result.final.holdMs, style).toBe(0);
      expect(result.final.formIssues).toEqual(["body_on_floor"]);
    }
  });

  it("dropping to the knees mid-hold pauses the timer with body_on_floor", () => {
    const frames = plankSequence({ durationMs: 9000, kneeBendDeg: (t) => (t > 3000 && t < 6000 ? 25 : 0) });
    const result = runFrames("plank", frames);
    expect(eventsOfType(result, "hold_pause").map((e) => e.reason)).toEqual(["body_on_floor"]);
    expect(result.final.holdMs).toBeGreaterThan(5800);
    expect(result.final.holdMs).toBeLessThan(6150);
  });

  it("lying flat counts when arm support is not required (documents the option)", () => {
    const result = runFrames("plank", plankSequence({ durationMs: 5000, style: "prone" }), {
      requireArmSupport: false,
    });
    expect(result.final.holdMs).toBeGreaterThan(4900);
  });

  it("standing is not a plank", () => {
    const result = runFrames("plank", squatSequence({ reps: 2 }));
    expect(result.final.holdMs).toBe(0);
    expect(result.issuesSeen.has("body_not_horizontal")).toBe(true);
  });
});
