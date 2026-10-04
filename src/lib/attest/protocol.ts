/**
 * Request / response DTOs of the attestor API (client-safe; shared by the routes and the client).
 *
 *   POST /api/attest/start   StartRequest  -> StartResponse
 *   POST /api/attest/chunk   ChunkRequest  -> ChunkResponse   (send every ~1 s, in seq order)
 *   POST /api/attest/finish  FinishRequest -> FinishResponse
 *
 * Errors use ApiError from src/lib/solana/types.ts: { error, code, retryAfterSec? }.
 *
 * Challenge flow: StartResponse.challengePlan tells the client WHEN challenges come (so it keeps
 * the workout open long enough) but never WHICH: `type` is null. The type and prompt are revealed
 * only in the ChunkResponse once a challenge is due (`dueChallenge`), and repeated in every chunk
 * response while its window is open. Answers only count in frames recorded after the reveal.
 */
import type { ExerciseKind } from "@/lib/pose/types";
import type { ChallengeType } from "./challenges";
import type { EncodedChunk } from "./trace";

export interface StartRequest {
  wallet: string;
  dayIndex: number;
  exercise: ExerciseKind;
  goalTarget: number;
}

export interface ChallengePlanEntry {
  id: string;
  atMsFromStart: number;
  windowMs: number;
  /** Always null here: the type is revealed in a chunk response when due. */
  type: null;
}

export interface StartResponse {
  sessionId: string;
  /** Server epoch ms at session start. Start the TraceRecorder clock when this arrives. */
  serverTime: number;
  exercise: ExerciseKind;
  goalTarget: number;
  challengePlan: ChallengePlanEntry[];
  /** Suggested chunk cadence. */
  chunkIntervalMs: number;
  /** Max base64 chars for one chunk's `data`. */
  maxChunkChars: number;
  /** Chunks are refused this long after start. */
  maxDurationMs: number;
}

export interface ChunkRequest {
  sessionId: string;
  chunk: EncodedChunk;
}

export interface DueChallenge {
  id: string;
  type: ChallengeType;
  prompt: string;
  windowMs: number;
  /** ms left in the window, by the server clock. */
  remainingMs: number;
}

export interface ChunkResponse {
  ack: { seq: number; frames: number; duplicate: boolean };
  serverElapsedMs: number;
  dueChallenge: DueChallenge | null;
  /** Challenges not yet revealed. */
  challengesPending: number;
}

export interface FinishRequest {
  sessionId: string;
}

export type FinishOnchainStatus =
  | { status: "submitted"; signature: string }
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "skipped"; message: string };

export interface FinishResponse {
  verdict: "pass" | "fail";
  /** Server-computed reps (or whole plank seconds). */
  count: number;
  goalTarget: number;
  /** Stable reason codes (VerifyReason) when verdict is "fail". */
  reasons: string[];
  /** hex sha256 session hash (written on-chain on pass). */
  sessionHash: string;
  /** null when the verdict is "fail". */
  onchain: FinishOnchainStatus | null;
}
