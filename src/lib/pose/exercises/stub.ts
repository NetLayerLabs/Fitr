/**
 * Placeholder engine for exercises whose real engine is not built yet. It is a valid,
 * deterministic RepEngine that never leaves 'searching' and never counts anything, so a stake
 * on such an exercise can never be met by it (the attestor re-runs the same engine).
 * It still keeps honest frame statistics in summary().
 */
import { readPoseLandmarks, readTimestamp } from "@/lib/pose/engine/common";
import type { EngineState, EngineUpdate, ExerciseKind, PoseFrame, RepEngine, SessionSummary } from "@/lib/pose/types";

export class StubEngine implements RepEngine {
  private framesProcessed = 0;
  private framesWithPose = 0;
  private firstPoseMs: number | null = null;
  private lastPoseMs: number | null = null;

  constructor(readonly exercise: ExerciseKind) {}

  update(frame: PoseFrame): EngineUpdate {
    this.framesProcessed++;
    const t = readTimestamp(frame);
    if (t !== null && readPoseLandmarks(frame)) {
      this.framesWithPose++;
      if (this.firstPoseMs === null) this.firstPoseMs = t;
      if (this.lastPoseMs === null || t > this.lastPoseMs) this.lastPoseMs = t;
    }
    return { state: this.getState(), events: [] };
  }

  getState(): EngineState {
    return {
      exercise: this.exercise,
      phase: "searching",
      reps: 0,
      rejectedReps: 0,
      holdMs: 0,
      primaryAngleDeg: null,
      bodyLineDeg: null,
      formIssues: [],
      trackingConfidence: 0,
      side: null,
    };
  }

  summary(): SessionSummary {
    return {
      exercise: this.exercise,
      reps: 0,
      rejectedReps: 0,
      holdMs: 0,
      repDurationsMs: [],
      activeMs:
        this.firstPoseMs !== null && this.lastPoseMs !== null ? Math.max(0, this.lastPoseMs - this.firstPoseMs) : 0,
      framesProcessed: this.framesProcessed,
      framesWithPose: this.framesWithPose,
      avgTrackingConfidence: 0,
    };
  }

  reset(): void {
    this.framesProcessed = 0;
    this.framesWithPose = 0;
    this.firstPoseMs = null;
    this.lastPoseMs = null;
  }
}

export function createStubEngine(exercise: ExerciseKind): RepEngine {
  return new StubEngine(exercise);
}
