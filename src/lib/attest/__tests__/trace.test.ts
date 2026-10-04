import { describe, expect, it } from "vitest";
import { createRepEngine } from "@/lib/pose/engine";
import { LM } from "@/lib/pose/landmarks";
import { pushupSequence } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { TraceRecorder } from "../recorder";
import {
  base64ToBytes,
  bytesToBase64,
  decodeChunk,
  decodeChunkBytes,
  encodeChunk,
  encodeChunkBytes,
  poseFrameFromTrace,
  sessionHash,
  toHex,
  traceContentHash,
  TraceFormatError,
  traceFrameFromPose,
  type TraceChunk,
} from "../trace";

const frames = pushupSequence({ reps: 3, startMs: 1000, seed: 2 });

function sampleChunk(): TraceChunk {
  return {
    seq: 7,
    frames: [
      traceFrameFromPose(frames[0], 900)!,
      { tMs: 150, imageWidth: 640, imageHeight: 480, joints: null },
      traceFrameFromPose(frames[5], 900)!,
    ],
    events: [
      { type: "rep", tMs: 120, extra: 1 },
      { type: "rep_rejected", tMs: 130, extra: 9 },
    ],
  };
}

describe("trace encode/decode", () => {
  it("round-trips a chunk exactly (after quantization)", () => {
    const chunk = sampleChunk();
    const enc = encodeChunk(chunk);
    expect(enc.v).toBe(1);
    expect(enc.seq).toBe(7);
    const { chunk: dec } = decodeChunk(enc);
    expect(dec).toEqual(chunk);
  });

  it("quantizes to within 1e-4 and keeps visibility to 1/255", () => {
    const tf = traceFrameFromPose(frames[10], 1000)!;
    const src = frames[10].landmarks[LM.LEFT_ELBOW];
    const k = 5; // index of LEFT_ELBOW in TRACE_JOINTS
    expect(Math.abs(tf.joints![k].x - src.x)).toBeLessThan(1e-4);
    expect(Math.abs(tf.joints![k].y - src.y)).toBeLessThan(1e-4);
    expect(Math.abs(tf.joints![k].visibility - src.visibility)).toBeLessThanOrEqual(1 / 255);
  });

  it("drops frames before the origin", () => {
    expect(traceFrameFromPose(frames[0], 5000)).toBeNull();
  });

  it("rejects malformed input", () => {
    const bytes = encodeChunkBytes(sampleChunk());
    expect(() => decodeChunkBytes(bytes.subarray(0, bytes.length - 1))).toThrow(TraceFormatError);
    expect(() => decodeChunkBytes(new Uint8Array([...bytes, 0]))).toThrow(TraceFormatError);
    const badMagic = new Uint8Array(bytes);
    badMagic[0] = 0;
    expect(() => decodeChunkBytes(badMagic)).toThrow(TraceFormatError);
    expect(() => base64ToBytes("not base64!")).toThrow(TraceFormatError);
    const enc = encodeChunk(sampleChunk());
    expect(() => decodeChunk({ ...enc, seq: 8 })).toThrow(/seq mismatch/);
  });

  it("base64 helpers round-trip large buffers", () => {
    const big = new Uint8Array(100_000).map((_, i) => (i * 31) & 0xff);
    expect(base64ToBytes(bytesToBase64(big))).toEqual(big);
  });

  it("the engine counts the same reps on the decoded trace as on the raw frames", () => {
    const seq = pushupSequence({ reps: 6, startMs: 0, seed: 4, jitterDeg: 2 });
    const raw = createRepEngine("pushup");
    for (const f of seq) raw.update(f);
    const rec = new TraceRecorder({ originMs: 0 });
    for (const f of seq) rec.push(f);
    const decoded: PoseFrame[] = [];
    for (let c = rec.drainChunk(); c; c = rec.drainChunk()) {
      for (const f of decodeChunk(c).chunk.frames) decoded.push(poseFrameFromTrace(f));
    }
    const server = createRepEngine("pushup");
    for (const f of decoded) server.update(f);
    expect(server.summary().reps).toBe(6);
    expect(server.summary().reps).toBe(raw.summary().reps);
  });
});

describe("TraceRecorder", () => {
  it("splits into chunks under the byte cap with consecutive seqs and keeps every frame", () => {
    const seq = pushupSequence({ reps: 5, startMs: 0, seed: 1 });
    const rec = new TraceRecorder({ originMs: 0, maxChunkBytes: 8192 });
    const engine = createRepEngine("pushup");
    for (const f of seq) rec.push(f, engine.update(f));
    const chunks = [];
    for (let c = rec.drainChunk(); c; c = rec.drainChunk()) chunks.push(c);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.map((c) => c.seq)).toEqual(chunks.map((_, i) => i));
    const decoded = chunks.map((c) => decodeChunk(c));
    for (const d of decoded) expect(d.bytes.length).toBeLessThanOrEqual(8192);
    expect(decoded.reduce((n, d) => n + d.chunk.frames.length, 0)).toBe(seq.length);
    const reps = decoded.flatMap((d) => d.chunk.events).filter((e) => e.type === "rep");
    expect(reps.map((e) => e.extra)).toEqual([1, 2, 3, 4, 5]);
    expect(rec.summary()).toMatchObject({ framesRecorded: seq.length, reps: 5, chunksDrained: chunks.length });
  });

  it("drops out-of-order frames", () => {
    const rec = new TraceRecorder({ originMs: 0 });
    rec.push(frames[5]);
    rec.push(frames[4]);
    expect(rec.summary()).toMatchObject({ framesRecorded: 1, framesDropped: 1 });
  });
});

describe("hashes", () => {
  it("content hash ignores seq; session hash binds the parameters", async () => {
    const a = encodeChunkBytes({ ...sampleChunk(), seq: 0 });
    const b = encodeChunkBytes({ ...sampleChunk(), seq: 5, events: [] });
    const ha = toHex(await traceContentHash([a]));
    expect(toHex(await traceContentHash([b]))).toBe(ha);
    expect(ha).toMatch(/^[0-9a-f]{64}$/);
    const content = await traceContentHash([a]);
    const base = { wallet: "W", dayIndex: 1, exercise: "pushup", goalTarget: 10, sessionStartedAt: 5, contentHash: content };
    const h1 = toHex(await sessionHash(base));
    expect(toHex(await sessionHash({ ...base }))).toBe(h1);
    expect(toHex(await sessionHash({ ...base, dayIndex: 2 }))).not.toBe(h1);
    expect(toHex(await sessionHash({ ...base, wallet: "X" }))).not.toBe(h1);
  });
});
