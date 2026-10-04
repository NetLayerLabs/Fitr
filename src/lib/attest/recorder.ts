/**
 * Client-side trace recorder. Pure TypeScript (no DOM / Node APIs), so it is safe in the
 * browser, in workers and in tests.
 *
 * Usage:
 *   const rec = new TraceRecorder({ originMs: performance.now() }); // right when /start returns
 *   ...each processed frame: rec.push(frame, engine.update(frame));
 *   ...every ~1 s: const chunk = rec.drainChunk(); if (chunk) POST /api/attest/chunk
 *
 * `originMs` must be taken when the server's /start response arrives: the server checks that the
 * trace clock never runs ahead of its own clock and only accepts challenge answers in frames
 * recorded after the challenge was revealed.
 */
import type { EngineUpdate, PoseFrame } from "@/lib/pose/types";
import {
  CHUNK_HEADER_BYTES,
  encodeChunk,
  EVENT_BYTES,
  FRAME_BASE_BYTES,
  FRAME_POSE_BYTES,
  MAX_EVENTS_PER_CHUNK,
  MAX_FRAMES_PER_CHUNK,
  traceEventFromEngine,
  traceFrameFromPose,
  type EncodedChunk,
  type TraceEvent,
  type TraceFrame,
} from "./trace";

export interface TraceRecorderOptions {
  /** performance.now()-based time the trace clock starts at (the /start response). */
  originMs: number;
  /** Drop frames closer than this to the previous kept frame. Default 0 (keep every frame). */
  minFrameIntervalMs?: number;
  /** Hard cap on encoded bytes per chunk before base64. Default 96 KiB. */
  maxChunkBytes?: number;
}

export interface TraceRecorderSummary {
  framesRecorded: number;
  framesDropped: number;
  chunksDrained: number;
  bytesDrained: number;
  pendingFrames: number;
  /** Trace time of the last recorded frame, or null. */
  lastFrameMs: number | null;
  /** Client engine's latest counts (display only; the server recomputes them). */
  reps: number;
  holdMs: number;
}

export class TraceRecorder {
  private readonly originMs: number;
  private readonly minIntervalMs: number;
  private readonly maxChunkBytes: number;
  private frames: TraceFrame[] = [];
  private events: TraceEvent[] = [];
  private pendingBytes = CHUNK_HEADER_BYTES;
  private seq = 0;
  private lastMs: number | null = null;
  private recorded = 0;
  private dropped = 0;
  private bytesDrained = 0;
  private drained = 0;
  private reps = 0;
  private holdMs = 0;
  /** Chunks that were split off because the pending buffer hit maxChunkBytes. */
  private ready: EncodedChunk[] = [];

  constructor(options: TraceRecorderOptions) {
    if (!Number.isFinite(options.originMs)) throw new Error("TraceRecorder: originMs must be a finite number");
    this.originMs = options.originMs;
    this.minIntervalMs = Math.max(0, options.minFrameIntervalMs ?? 0);
    this.maxChunkBytes = Math.max(4096, options.maxChunkBytes ?? 96 * 1024);
  }

  push(frame: PoseFrame, update?: EngineUpdate): void {
    if (update) {
      this.reps = update.state.reps;
      this.holdMs = update.state.holdMs;
      for (const ev of update.events) {
        const te = traceEventFromEngine(ev, this.originMs);
        if (!te) continue;
        this.ensureRoom(EVENT_BYTES);
        this.events.push(te);
        this.pendingBytes += EVENT_BYTES;
      }
    }
    const tf = traceFrameFromPose(frame, this.originMs);
    const tooSoon = this.lastMs !== null && (tf === null || tf.tMs <= this.lastMs || tf.tMs - this.lastMs < this.minIntervalMs);
    if (!tf || tooSoon) {
      this.dropped++;
      return;
    }
    const size = FRAME_BASE_BYTES + (tf.joints ? FRAME_POSE_BYTES : 0);
    this.ensureRoom(size);
    this.frames.push(tf);
    this.pendingBytes += size;
    this.lastMs = tf.tMs;
    this.recorded++;
  }

  /** Next chunk to upload (oldest first), or null when nothing is pending. */
  drainChunk(): EncodedChunk | null {
    let chunk: EncodedChunk | null = null;
    if (this.ready.length > 0) chunk = this.ready.shift()!;
    else if (this.frames.length > 0 || this.events.length > 0) chunk = this.cut();
    if (chunk) {
      this.drained++;
      this.bytesDrained += Math.floor((chunk.data.length * 3) / 4);
    }
    return chunk;
  }

  /** True when more than one chunk is waiting (e.g. after a network outage). */
  hasBacklog(): boolean {
    return this.ready.length > 0;
  }

  summary(): TraceRecorderSummary {
    return {
      framesRecorded: this.recorded,
      framesDropped: this.dropped,
      chunksDrained: this.drained,
      bytesDrained: this.bytesDrained,
      pendingFrames: this.frames.length,
      lastFrameMs: this.lastMs,
      reps: this.reps,
      holdMs: this.holdMs,
    };
  }

  private ensureRoom(bytes: number): void {
    if (
      this.pendingBytes + bytes > this.maxChunkBytes ||
      this.frames.length >= MAX_FRAMES_PER_CHUNK ||
      this.events.length >= MAX_EVENTS_PER_CHUNK
    ) {
      this.ready.push(this.cut());
    }
  }

  private cut(): EncodedChunk {
    const chunk = encodeChunk({ seq: this.seq++, frames: this.frames, events: this.events });
    this.frames = [];
    this.events = [];
    this.pendingBytes = CHUNK_HEADER_BYTES;
    return chunk;
  }
}
