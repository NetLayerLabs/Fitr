import { describe, expect, it } from "vitest";
import { LM } from "@/lib/pose/landmarks";
import { plankSequence, pushupSequence, withTeleport } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { verifySession, type ChallengeRecord, type ChunkReceipt, type VerifyInput } from "../verify";
import { pushupSessionFrames, squatSessionFrames, withRaisedHand } from "./helpers";

const challenge = (revealedAtTraceMs: number | null, type: ChallengeRecord["type"] = "raise_right_hand"): ChallengeRecord => ({
  id: "c1",
  type,
  atMsFromStart: 8000,
  windowMs: 6000,
  revealedAtTraceMs,
});

/** Real-time receipts: every 1 s chunk arrives 100 ms after its last frame. */
function receipts(frames: readonly PoseFrame[], lagMs = 100): ChunkReceipt[] {
  const out: ChunkReceipt[] = [];
  if (frames.length === 0) return out;
  for (let s = 0; s * 1000 <= frames[frames.length - 1].timestampMs; s++) {
    const inChunk = frames.filter((f) => f.timestampMs >= s * 1000 && f.timestampMs < (s + 1) * 1000);
    if (!inChunk.length) continue;
    const lastMs = inChunk[inChunk.length - 1].timestampMs;
    out.push({ seq: s, firstMs: inChunk[0].timestampMs, lastMs, receivedAtElapsedMs: lastMs + lagMs });
  }
  return out;
}

const cleanFrames = withRaisedHand(pushupSessionFrames(), "right", 8500, 10500);

function input(over: Partial<VerifyInput> = {}): VerifyInput {
  const frames = over.frames ?? cleanFrames;
  return {
    exercise: "pushup",
    goalTarget: 10,
    frames,
    chunks: receipts(frames),
    challenges: [challenge(7000)],
    ...over,
  };
}

describe("verifySession", () => {
  it("passes a clean synthetic push-up session with the challenge answered", () => {
    const r = verifySession(input());
    expect(r.reasons).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.count).toBe(10);
    expect(r.metrics.challenges[0]).toMatchObject({ passed: true });
    expect(r.metrics.teleportPairs).toBe(0);
  });

  it("passes a clean squat session with a hold-still challenge", () => {
    const frames = squatSessionFrames();
    const r = verifySession({
      exercise: "squat",
      goalTarget: 15,
      frames,
      chunks: receipts(frames),
      challenges: [{ ...challenge(8000, "hold_still_top"), windowMs: 8000 }],
    });
    expect(r.reasons).toEqual([]);
    expect(r.count).toBe(15);
  });

  it("passes a 36 s plank (count = whole seconds held) with a hand raise", () => {
    const frames = withRaisedHand(plankSequence({ durationMs: 36_000, startMs: 100, seed: 2, jitterDeg: 1 }), "right", 9000, 11_000);
    const r = verifySession({ exercise: "plank", goalTarget: 30, frames, chunks: receipts(frames), challenges: [challenge(7500)] });
    expect(r.reasons).toEqual([]);
    expect(r.count).toBeGreaterThanOrEqual(30);
  });

  it("fails below the committed goal (count is the server's own)", () => {
    const r = verifySession(input({ goalTarget: 12 }));
    expect(r.ok).toBe(false);
    expect(r.count).toBe(10);
    expect(r.reasons).toContain("below_goal");
  });

  it("fails with teleporting joints", () => {
    let frames: PoseFrame[] = cleanFrames;
    for (let t = 500; t < 19_000; t += 400) {
      frames = withTeleport(frames, t, { joints: [LM.LEFT_KNEE, LM.RIGHT_KNEE], dx: 0.35, dy: -0.3 });
    }
    const r = verifySession(input({ frames }));
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain("teleporting_joints");
  });

  it("fails a session too short for the goal", () => {
    const frames = withRaisedHand(
      pushupSequence({ reps: 10, repMs: 450, holdMs: 60, leadInMs: 300, leadOutMs: 200, startMs: 0 }),
      "right",
      2000,
      3000,
    );
    const r = verifySession(input({ frames, challenges: [challenge(1500)] }));
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain("session_too_short");
  });

  it("fails when the challenge was not answered", () => {
    const frames = pushupSessionFrames();
    const r = verifySession(input({ frames }));
    expect(r.ok).toBe(false);
    expect(r.reasons).toEqual(["challenge_missed"]);
  });

  it("fails when the wrong hand is raised", () => {
    const frames = withRaisedHand(pushupSessionFrames(), "left", 8500, 10500);
    const r = verifySession(input({ frames }));
    expect(r.reasons).toContain("challenge_missed");
  });

  it("does not credit an answer recorded before the reveal", () => {
    const r = verifySession(input({ challenges: [challenge(11_000)] }));
    expect(r.reasons).toContain("challenge_missed");
  });

  it("fails when a planned challenge was never issued (finished early)", () => {
    const r = verifySession(input({ challenges: [challenge(null)] }));
    expect(r.reasons).toContain("challenge_not_issued");
  });

  it("fails a trace uploaded faster than real time", () => {
    const chunks = receipts(cleanFrames).map((c) => ({ ...c, receivedAtElapsedMs: 2000 }));
    const r = verifySession(input({ chunks }));
    expect(r.reasons).toContain("trace_ahead_of_clock");
  });

  it("fails a duplicated session fingerprint", () => {
    const r = verifySession(input({ duplicateContent: true }));
    expect(r.reasons).toEqual(["duplicate_session"]);
  });

  it("fails inconsistent bone lengths (naive synthetic skeleton)", () => {
    const frames = cleanFrames.map((f, i) => {
      if (i % 3 !== 0) return f;
      const lms = f.landmarks.map((l) => ({ ...l }));
      // Stretch the shins / forearms of every third frame.
      for (const [a, b] of [
        [LM.LEFT_KNEE, LM.LEFT_ANKLE],
        [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
      ] as const) {
        lms[b] = { ...lms[b], x: lms[a].x + (lms[b].x - lms[a].x) * 1.8, y: lms[a].y + (lms[b].y - lms[a].y) * 1.8 };
      }
      return { ...f, landmarks: lms };
    });
    const r = verifySession(input({ frames, config: { teleportMinCount: 1e9 } }));
    expect(r.reasons).toContain("bone_length_inconsistent");
  });

  it("fails low tracking confidence and empty traces", () => {
    const low = cleanFrames.map((f, i) => (i % 3 === 0 ? f : { ...f, landmarks: [] }));
    expect(verifySession(input({ frames: low })).reasons).toContain("low_tracking_confidence");
    expect(verifySession(input({ frames: [], chunks: [] })).reasons).toContain("no_frames");
  });
});
