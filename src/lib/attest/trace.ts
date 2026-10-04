/**
 * Compact pose-session trace ("transcript") that the client streams to the attestor.
 *
 * Client-safe: no Node APIs. Hashing uses WebCrypto (`globalThis.crypto.subtle`), which exists in
 * browsers (secure contexts) and in Node >= 20, so client and server compute identical hashes.
 *
 * Binary chunk layout (little-endian), base64-encoded on the wire:
 *
 *   header  (12 B): magic "FT" (2 x u8), version u8, reserved u8, seq u32, frameCount u16, eventCount u16
 *   frame   (9 B + 85 B when a pose is present):
 *           tMs u32 (ms since the recorder origin), imageWidth u16, imageHeight u16, flags u8 (bit0 = pose)
 *           then, when bit0 is set, for each of the TRACE_JOINTS: x i16, y i16, visibility u8
 *   event   (7 B): type u8, tMs u32, extra u16 (repIndex for "rep", reason code for rejections/pauses)
 *
 * x / y are normalized MediaPipe coordinates quantized as round(v * 8192) (range about +-4, i.e.
 * 0.06 px resolution on a 480 px frame); visibility is round(v * 255). `z` is not traced: the rep
 * engine only reads 2D image landmarks.
 */
import { LANDMARK_COUNT, LM } from "@/lib/pose/landmarks";
import type { EngineEvent, FormIssue, Landmark, PoseFrame } from "@/lib/pose/types";

export const TRACE_VERSION = 1;

/** Landmarks kept in the trace: everything the rep engine and the live challenges read. */
export const TRACE_JOINTS: readonly number[] = [
  LM.NOSE,
  LM.LEFT_EAR,
  LM.RIGHT_EAR,
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_ELBOW,
  LM.RIGHT_ELBOW,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
  LM.LEFT_HEEL,
  LM.RIGHT_HEEL,
];

const MAGIC_0 = 0x46; // "F"
const MAGIC_1 = 0x54; // "T"
export const CHUNK_HEADER_BYTES = 12;
export const FRAME_BASE_BYTES = 9;
export const JOINT_BYTES = 5;
export const FRAME_POSE_BYTES = TRACE_JOINTS.length * JOINT_BYTES;
export const EVENT_BYTES = 7;
/** u16 frame / event counters. */
export const MAX_FRAMES_PER_CHUNK = 0xffff;
export const MAX_EVENTS_PER_CHUNK = 0xffff;

const COORD_SCALE = 8192;
const U32_MAX = 0xffffffff;

/** One frame of the trace (quantization already applied when it came out of decodeChunk). */
export interface TraceFrame {
  /** ms since the recorder origin (integer, u32). */
  tMs: number;
  imageWidth: number;
  imageHeight: number;
  /** Landmarks for TRACE_JOINTS in that order, or null when no pose was detected. */
  joints: Array<{ x: number; y: number; visibility: number }> | null;
}

export type TraceEventType = "phase" | "rep" | "rep_rejected" | "hold_start" | "hold_pause";

/** Client engine events, kept for audit / diagnostics only. The server never trusts them. */
export interface TraceEvent {
  type: TraceEventType;
  tMs: number;
  /** repIndex for "rep"; FormIssue code index for "rep_rejected" / "hold_pause"; else 0. */
  extra: number;
}

export interface TraceChunk {
  seq: number;
  frames: TraceFrame[];
  events: TraceEvent[];
}

/** Wire format of one chunk. */
export interface EncodedChunk {
  v: typeof TRACE_VERSION;
  seq: number;
  /** base64 of the binary layout described at the top of this file. */
  data: string;
}

export class TraceFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraceFormatError";
  }
}

const EVENT_CODES: Record<TraceEventType, number> = {
  phase: 0,
  rep: 1,
  rep_rejected: 2,
  hold_start: 3,
  hold_pause: 4,
};
const EVENT_TYPES: TraceEventType[] = ["phase", "rep", "rep_rejected", "hold_start", "hold_pause"];

/** Stable FormIssue <-> code table for event `extra`. Append only. */
export const FORM_ISSUE_CODES: readonly FormIssue[] = [
  "body_not_visible",
  "unstable_tracking",
  "go_lower",
  "extend_fully",
  "hips_sagging",
  "hips_piked",
  "body_not_horizontal",
  "body_on_floor",
  "chest_up",
  "too_fast",
];

// ---------------------------------------------------------------------------------------
// Quantization helpers
// ---------------------------------------------------------------------------------------

const clampInt = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function quantizeCoord(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return clampInt(Math.round(v * COORD_SCALE), -32768, 32767);
}

export function dequantizeCoord(q: number): number {
  return q / COORD_SCALE;
}

export function quantizeVisibility(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return clampInt(Math.round(v * 255), 0, 255);
}

const clampU16 = (v: number) => (Number.isFinite(v) ? clampInt(Math.round(v), 0, 0xffff) : 0);

/** PoseFrame -> TraceFrame for a recorder origin; returns null for frames before the origin. */
export function traceFrameFromPose(frame: PoseFrame, originMs: number): TraceFrame | null {
  const rel = Math.round(frame.timestampMs - originMs);
  if (!Number.isFinite(rel) || rel < 0 || rel > U32_MAX) return null;
  const lms = frame.landmarks;
  const hasPose = Array.isArray(lms) && lms.length >= LANDMARK_COUNT;
  return {
    tMs: rel,
    imageWidth: clampU16(frame.imageWidth),
    imageHeight: clampU16(frame.imageHeight),
    joints: hasPose
      ? TRACE_JOINTS.map((i) => {
          const lm = lms[i];
          return {
            x: dequantizeCoord(quantizeCoord(lm?.x ?? NaN)),
            y: dequantizeCoord(quantizeCoord(lm?.y ?? NaN)),
            visibility: quantizeVisibility(lm?.visibility ?? 0) / 255,
          };
        })
      : null,
  };
}

/** EngineEvent -> TraceEvent (times relative to the recorder origin). */
export function traceEventFromEngine(event: EngineEvent, originMs: number): TraceEvent | null {
  const tMs = Math.round(event.tMs - originMs);
  if (!Number.isFinite(tMs) || tMs < 0 || tMs > U32_MAX) return null;
  let extra = 0;
  if (event.type === "rep") extra = clampU16(event.repIndex);
  else if (event.type === "rep_rejected" || event.type === "hold_pause")
    extra = Math.max(0, FORM_ISSUE_CODES.indexOf(event.reason));
  return { type: event.type, tMs, extra };
}

const EMPTY_LANDMARK: Landmark = Object.freeze({ x: 0, y: 0, z: 0, visibility: 0 }) as Landmark;

/** TraceFrame -> PoseFrame the rep engine can consume (untraced landmarks have visibility 0). */
export function poseFrameFromTrace(frame: TraceFrame): PoseFrame {
  let landmarks: Landmark[] = [];
  if (frame.joints) {
    landmarks = new Array<Landmark>(LANDMARK_COUNT).fill(EMPTY_LANDMARK);
    TRACE_JOINTS.forEach((idx, k) => {
      const j = frame.joints![k];
      landmarks[idx] = { x: j.x, y: j.y, z: 0, visibility: j.visibility };
    });
  }
  return { timestampMs: frame.tMs, landmarks, imageWidth: frame.imageWidth, imageHeight: frame.imageHeight };
}

// ---------------------------------------------------------------------------------------
// Binary encode / decode
// ---------------------------------------------------------------------------------------

export function encodeChunkBytes(chunk: TraceChunk): Uint8Array {
  const { seq, frames, events } = chunk;
  if (!Number.isInteger(seq) || seq < 0 || seq > U32_MAX) throw new TraceFormatError("seq out of range");
  if (frames.length > MAX_FRAMES_PER_CHUNK) throw new TraceFormatError("too many frames");
  if (events.length > MAX_EVENTS_PER_CHUNK) throw new TraceFormatError("too many events");
  let size = CHUNK_HEADER_BYTES + events.length * EVENT_BYTES;
  for (const f of frames) size += FRAME_BASE_BYTES + (f.joints ? FRAME_POSE_BYTES : 0);
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  buf[0] = MAGIC_0;
  buf[1] = MAGIC_1;
  buf[2] = TRACE_VERSION;
  buf[3] = 0;
  dv.setUint32(4, seq, true);
  dv.setUint16(8, frames.length, true);
  dv.setUint16(10, events.length, true);
  let o = CHUNK_HEADER_BYTES;
  for (const f of frames) {
    dv.setUint32(o, clampInt(Math.round(f.tMs), 0, U32_MAX), true);
    dv.setUint16(o + 4, clampU16(f.imageWidth), true);
    dv.setUint16(o + 6, clampU16(f.imageHeight), true);
    buf[o + 8] = f.joints ? 1 : 0;
    o += FRAME_BASE_BYTES;
    if (f.joints) {
      if (f.joints.length !== TRACE_JOINTS.length) throw new TraceFormatError("joint count mismatch");
      for (const j of f.joints) {
        dv.setInt16(o, quantizeCoord(j.x), true);
        dv.setInt16(o + 2, quantizeCoord(j.y), true);
        buf[o + 4] = quantizeVisibility(j.visibility);
        o += JOINT_BYTES;
      }
    }
  }
  for (const e of events) {
    buf[o] = EVENT_CODES[e.type];
    dv.setUint32(o + 1, clampInt(Math.round(e.tMs), 0, U32_MAX), true);
    dv.setUint16(o + 5, clampU16(e.extra), true);
    o += EVENT_BYTES;
  }
  return buf;
}

/** Strict decoder: throws TraceFormatError on any malformed input (never trusts lengths). */
export function decodeChunkBytes(buf: Uint8Array): TraceChunk {
  if (buf.length < CHUNK_HEADER_BYTES) throw new TraceFormatError("chunk too short");
  if (buf[0] !== MAGIC_0 || buf[1] !== MAGIC_1) throw new TraceFormatError("bad magic");
  if (buf[2] !== TRACE_VERSION) throw new TraceFormatError("unsupported version");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const seq = dv.getUint32(4, true);
  const frameCount = dv.getUint16(8, true);
  const eventCount = dv.getUint16(10, true);
  let o = CHUNK_HEADER_BYTES;
  const frames: TraceFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    if (o + FRAME_BASE_BYTES > buf.length) throw new TraceFormatError("truncated frame");
    const tMs = dv.getUint32(o, true);
    const imageWidth = dv.getUint16(o + 4, true);
    const imageHeight = dv.getUint16(o + 6, true);
    const flags = buf[o + 8];
    if (flags & ~1) throw new TraceFormatError("unknown frame flags");
    o += FRAME_BASE_BYTES;
    let joints: TraceFrame["joints"] = null;
    if (flags & 1) {
      if (o + FRAME_POSE_BYTES > buf.length) throw new TraceFormatError("truncated joints");
      joints = new Array(TRACE_JOINTS.length);
      for (let k = 0; k < TRACE_JOINTS.length; k++) {
        joints[k] = {
          x: dequantizeCoord(dv.getInt16(o, true)),
          y: dequantizeCoord(dv.getInt16(o + 2, true)),
          visibility: buf[o + 4] / 255,
        };
        o += JOINT_BYTES;
      }
    }
    frames.push({ tMs, imageWidth, imageHeight, joints });
  }
  const events: TraceEvent[] = [];
  for (let i = 0; i < eventCount; i++) {
    if (o + EVENT_BYTES > buf.length) throw new TraceFormatError("truncated event");
    const type = EVENT_TYPES[buf[o]];
    if (!type) throw new TraceFormatError("unknown event type");
    events.push({ type, tMs: dv.getUint32(o + 1, true), extra: dv.getUint16(o + 5, true) });
    o += EVENT_BYTES;
  }
  if (o !== buf.length) throw new TraceFormatError("trailing bytes");
  return { seq, frames, events };
}

/** Byte range of the frame section (used for content fingerprints, independent of seq / events). */
export function frameSection(buf: Uint8Array): Uint8Array {
  const chunk = decodeChunkBytes(buf);
  let end = CHUNK_HEADER_BYTES;
  for (const f of chunk.frames) end += FRAME_BASE_BYTES + (f.joints ? FRAME_POSE_BYTES : 0);
  return buf.subarray(CHUNK_HEADER_BYTES, end);
}

export function encodeChunk(chunk: TraceChunk): EncodedChunk {
  return { v: TRACE_VERSION, seq: chunk.seq, data: bytesToBase64(encodeChunkBytes(chunk)) };
}

/** Decodes and cross-checks the envelope. Throws TraceFormatError. */
export function decodeChunk(encoded: EncodedChunk): { chunk: TraceChunk; bytes: Uint8Array } {
  if (!encoded || typeof encoded !== "object") throw new TraceFormatError("chunk must be an object");
  if (encoded.v !== TRACE_VERSION) throw new TraceFormatError("unsupported version");
  if (typeof encoded.data !== "string") throw new TraceFormatError("data must be base64");
  const bytes = base64ToBytes(encoded.data);
  const chunk = decodeChunkBytes(bytes);
  if (chunk.seq !== encoded.seq) throw new TraceFormatError("seq mismatch");
  return { chunk, bytes };
}

// ---------------------------------------------------------------------------------------
// base64 (atob / btoa exist in browsers and Node >= 16)
// ---------------------------------------------------------------------------------------

const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const STEP = 0x8000;
  for (let i = 0; i < bytes.length; i += STEP) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + STEP)));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  if (!BASE64_RE.test(b64)) throw new TraceFormatError("invalid base64");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------------------
// Hashing (WebCrypto)
// ---------------------------------------------------------------------------------------

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("WebCrypto (crypto.subtle) is unavailable; a secure context is required");
  return s;
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes); // detach from any shared / offset buffer
  return new Uint8Array(await subtle().digest("SHA-256", copy));
}

export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function toHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

/**
 * Content fingerprint: sha256 over the frame sections of all chunks in seq order. Independent of
 * seq numbers and client events, so a re-uploaded recording hashes the same in any session.
 */
export async function traceContentHash(chunkBytes: readonly Uint8Array[]): Promise<Uint8Array> {
  return sha256(concatBytes(chunkBytes.map(frameSection)));
}

export interface SessionHashInput {
  wallet: string;
  dayIndex: number;
  exercise: string;
  goalTarget: number;
  /** Unix seconds when the server started the session (the on-chain session_started_at). */
  sessionStartedAt: number;
  contentHash: Uint8Array;
}

/**
 * The 32-byte session hash written on-chain: binds the session parameters to the trace content.
 * sha256("fitr-session-v1|wallet|dayIndex|exercise|goalTarget|sessionStartedAt|" || contentHash).
 */
export async function sessionHash(input: SessionHashInput): Promise<Uint8Array> {
  const prefix = new TextEncoder().encode(
    `fitr-session-v1|${input.wallet}|${input.dayIndex}|${input.exercise}|${input.goalTarget}|${input.sessionStartedAt}|`,
  );
  return sha256(concatBytes([prefix, input.contentHash]));
}
