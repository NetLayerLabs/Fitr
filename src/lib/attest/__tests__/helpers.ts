import { LM } from "@/lib/pose/landmarks";
import {
  pushupSequence,
  squatSequence,
  type RepSpec,
} from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import type { PlannedChallenge } from "../challenges";
import type { AttestOnchain, OnchainCommitment, SubmitAttestationParams } from "../onchain";
import { TraceRecorder } from "../recorder";
import type { AttestService } from "../service";
import type { EncodedChunk } from "../trace";

export const WALLET_A = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";
export const WALLET_B = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";

/**
 * 10 clean push-ups (1.5 s each) with a 3.3 s pause at the top after rep 5 (t = 8.2-11.5 s),
 * timestamps starting at 100 ms. Total ~19.9 s.
 */
export function pushupSessionFrames(reps = 10, pauseAfter = 5, seed = 3): PoseFrame[] {
  const specs: RepSpec[] = Array.from({ length: reps }, (_, i) => (i === pauseAfter - 1 ? { holdMs: 3300 } : {}));
  return pushupSequence({ reps: specs, startMs: 100, seed, jitterDeg: 1 });
}

/** 15 squats (2 s each) with a 3.6 s pause standing after rep 4. */
export function squatSessionFrames(reps = 15, pauseAfter = 4): PoseFrame[] {
  const specs: RepSpec[] = Array.from({ length: reps }, (_, i) => (i === pauseAfter - 1 ? { holdMs: 3600 } : {}));
  return squatSequence({ reps: specs, startMs: 100, seed: 5, jitterDeg: 1 });
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * Raise one anatomical arm straight up over [fromMs, toMs] (absolute timestamps), easing in and
 * out over `rampMs`, keeping segment lengths. Returns new frames.
 */
export function withRaisedHand(
  frames: readonly PoseFrame[],
  side: "left" | "right",
  fromMs: number,
  toMs: number,
  rampMs = 300,
): PoseFrame[] {
  const S = side === "left" ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
  const E = side === "left" ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW;
  const W = side === "left" ? LM.LEFT_WRIST : LM.RIGHT_WRIST;
  return frames.map((f) => {
    const t = f.timestampMs;
    if (t < fromMs || t > toMs || f.landmarks.length === 0) return f;
    const k = Math.min(1, (t - fromMs) / rampMs, (toMs - t) / rampMs);
    const ar = f.imageWidth / f.imageHeight;
    const lms = f.landmarks.map((l) => ({ ...l }));
    const s = lms[S];
    const e = lms[E];
    const w = lms[W];
    const upper = Math.hypot((e.x - s.x) * ar, e.y - s.y);
    const fore = Math.hypot((w.x - e.x) * ar, w.y - e.y);
    lms[E] = { ...e, x: lerp(e.x, s.x, k), y: lerp(e.y, s.y - upper, k), visibility: Math.max(e.visibility, 0.9) };
    lms[W] = { ...w, x: lerp(w.x, s.x, k), y: lerp(w.y, s.y - upper - fore, k), visibility: Math.max(w.visibility, 0.9) };
    return { ...f, landmarks: lms };
  });
}

/** Records frames with a TraceRecorder (origin 0) and cuts a chunk every `chunkMs`. */
export function chunkFrames(frames: readonly PoseFrame[], chunkMs = 1000): Array<{ chunk: EncodedChunk; lastMs: number }> {
  const rec = new TraceRecorder({ originMs: 0 });
  const out: Array<{ chunk: EncodedChunk; lastMs: number }> = [];
  let boundary = chunkMs;
  let last = 0;
  for (const f of frames) {
    if (f.timestampMs >= boundary) {
      const c = rec.drainChunk();
      if (c) out.push({ chunk: c, lastMs: last });
      while (boundary <= f.timestampMs) boundary += chunkMs;
    }
    rec.push(f);
    last = f.timestampMs;
  }
  const c = rec.drainChunk();
  if (c) out.push({ chunk: c, lastMs: last });
  return out;
}

export class FakeClock {
  constructor(public t = 1_790_294_400_000 + 3_600_000) {}
  now = () => this.t;
}

export class FakeOnchain implements AttestOnchain {
  commitments = new Map<string, OnchainCommitment>();
  submitted: SubmitAttestationParams[] = [];
  failSubmit: Error | null = null;

  commit(wallet: string, dayIndex: number, c: Partial<OnchainCommitment> = {}): void {
    this.commitments.set(`${wallet}:${dayIndex}`, {
      exercise: "pushup",
      goalTarget: 10,
      status: "committed",
      committedAt: 1_790_294_400,
      ...c,
    });
  }

  async getCommitment(wallet: string, dayIndex: number) {
    return this.commitments.get(`${wallet}:${dayIndex}`) ?? null;
  }

  async submitAttestation(p: SubmitAttestationParams) {
    if (this.failSubmit) throw this.failSubmit;
    this.submitted.push(p);
    return { signature: `sig${this.submitted.length}` };
  }
}

export function fixedPlan(...items: Array<Pick<PlannedChallenge, "type" | "atMsFromStart">>) {
  return () =>
    items.map((c, i) => ({ id: `c${i + 1}`, type: c.type, atMsFromStart: c.atMsFromStart, windowMs: c.type === "hold_still_top" ? 8000 : 6000 }));
}

/** Uploads chunks in real time: each arrives 100 ms after its last frame (server clock). */
export async function streamChunks(
  service: AttestService,
  clock: FakeClock,
  sessionId: string,
  startedAt: number,
  chunks: Array<{ chunk: EncodedChunk; lastMs: number }>,
) {
  const responses = [];
  for (const { chunk, lastMs } of chunks) {
    clock.t = Math.max(clock.t, startedAt + lastMs + 100);
    responses.push(await service.chunk({ sessionId, chunk }));
  }
  return responses;
}
