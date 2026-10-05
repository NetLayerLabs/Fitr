/**
 * Shared contracts for the Fitr pose pipeline:
 *
 *   camera -> PoseDetector (MediaPipe) -> PoseFrame -> RepEngine -> EngineState/events -> UI
 *
 * This file is the source of truth that the engine, runtime, and UI code against.
 * It must stay free of browser and MediaPipe imports so the engine stays pure and testable.
 */

/**
 * One BlazePose landmark. Mirrors MediaPipe's NormalizedLandmark:
 * x, y are normalized to [0, 1] in *unmirrored* source-image space (x right, y down),
 * z is relative depth (smaller = closer to camera, roughly same scale as x),
 * visibility is the model's [0, 1] likelihood the point is visible.
 */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** A single processed video frame. */
export interface PoseFrame {
  /** Monotonically increasing timestamp in milliseconds (performance.now() based). */
  timestampMs: number;
  /** 33 landmarks when a pose is detected; empty array when no pose was found. */
  landmarks: Landmark[];
  /** Optional 3D world landmarks in meters, hip-centered (same indices). */
  worldLandmarks?: Landmark[];
  /** Source video dimensions, needed to correct normalized coords for aspect ratio. */
  imageWidth: number;
  imageHeight: number;
}

/**
 * Every exercise Fitr can count. The order of EXERCISE_KINDS is the onchain exercise code
 * (0..15) stored with each stake: NEVER reorder or remove entries, only append.
 */
export type ExerciseKind =
  | "pushup"
  | "squat"
  | "plank"
  | "lunge"
  | "situp"
  | "leg_raise"
  | "glute_bridge"
  | "wall_sit"
  | "pike_pushup"
  | "jump_squat"
  | "pullup"
  | "dip"
  | "burpee"
  | "mountain_climber"
  | "jumping_jack"
  | "high_knees";

/** All kinds in onchain code order (index = code). Append-only. */
export const EXERCISE_KINDS: readonly ExerciseKind[] = Object.freeze([
  "pushup",
  "squat",
  "plank",
  "lunge",
  "situp",
  "leg_raise",
  "glute_bridge",
  "wall_sit",
  "pike_pushup",
  "jump_squat",
  "pullup",
  "dip",
  "burpee",
  "mountain_climber",
  "jumping_jack",
  "high_knees",
] as const);

export function isExerciseKind(value: string): value is ExerciseKind {
  return (EXERCISE_KINDS as readonly string[]).includes(value);
}

/**
 * Engine phase.
 * - searching: no pose / key joints not visible enough to judge
 * - ready: body visible and in a valid start position, waiting for movement
 * - up / down: rep exercises position within a rep ("down" = the loaded / far end of the range)
 * - holding: a timed hold (plank, wall sit) is being held with valid form (timer running)
 * - paused: hold form broken or tracking lost beyond the grace period (timer stopped)
 */
export type EnginePhase = "searching" | "ready" | "up" | "down" | "holding" | "paused";

/** Form / tracking problems surfaced to the user. Keep codes stable; UI maps them to copy. */
export type FormIssue =
  | "body_not_visible"
  | "unstable_tracking"
  | "go_lower"
  | "extend_fully"
  | "hips_sagging"
  | "hips_piked"
  | "body_not_horizontal"
  /**
   * Push-up / plank: part of the body that should be off the floor is resting on it (lying
   * flat with the arms not propping the body up, or dropping to the knees).
   */
  | "body_on_floor"
  | "chest_up"
  | "too_fast"
  /** Tracking: a front-view exercise (jumping jacks, high knees, pull-ups) needs you square-on. */
  | "face_camera"
  /** Tracking: a side-view exercise needs you side-on to the camera. */
  | "turn_side_on"
  /** Wall sit: the back has come away from the wall (torso no longer upright). */
  | "keep_back_on_wall"
  /** Pike push-ups: hips have dropped out of the inverted-V. */
  | "keep_hips_high"
  /** Pull-ups: the chin did not clear the bar (wrist line). */
  | "chin_over_bar"
  /** Partial rep at the top end of the range (sit-up, leg raise, glute bridge, knee drives). */
  | "go_higher"
  /** Jumping jacks: hands did not meet overhead. */
  | "arms_overhead"
  /** Jump squats / burpees: feet never left the floor. */
  | "jump_higher";

export type BodySide = "left" | "right" | "both";

export interface EngineState {
  exercise: ExerciseKind;
  phase: EnginePhase;
  /** Valid, counted reps (always 0 for timed holds: plank, wall sit). */
  reps: number;
  /** Rep attempts that were rejected (partial range, too fast, bad form). */
  rejectedReps: number;
  /** Accumulated valid hold time in ms (timed holds only; 0 otherwise). */
  holdMs: number;
  /** Smoothed primary joint angle in degrees (elbow for push-up, knee for squat, body line for plank). */
  primaryAngleDeg: number | null;
  /** Smoothed shoulder-hip-ankle angle in degrees (180 = perfectly straight). */
  bodyLineDeg: number | null;
  /** Active issues this frame, most important first. Empty when form is good. */
  formIssues: FormIssue[];
  /** 0..1 tracking quality (mean visibility of the joints this exercise depends on). */
  trackingConfidence: number;
  /** Which body side the engine is currently reading, or null while searching. */
  side: BodySide | null;
}

export type EngineEvent =
  | { type: "phase"; from: EnginePhase; to: EnginePhase; tMs: number }
  | {
      type: "rep";
      /** 1-based index of the counted rep. */
      repIndex: number;
      durationMs: number;
      minAngleDeg: number;
      maxAngleDeg: number;
      tMs: number;
    }
  | { type: "rep_rejected"; reason: FormIssue; tMs: number }
  | { type: "hold_start"; tMs: number }
  | { type: "hold_pause"; reason: FormIssue; tMs: number };

export interface EngineUpdate {
  state: EngineState;
  /** Events emitted while processing this frame (often empty). */
  events: EngineEvent[];
}

/** Aggregate stats for a finished session; UI stamps wall-clock times and persists it. */
export interface SessionSummary {
  exercise: ExerciseKind;
  reps: number;
  rejectedReps: number;
  holdMs: number;
  /** Duration of each counted rep in ms, in order. */
  repDurationsMs: number[];
  /** ms between the first and last frame in which a pose was tracked. */
  activeMs: number;
  framesProcessed: number;
  framesWithPose: number;
  /** Mean trackingConfidence over frames with a pose (0 if none). */
  avgTrackingConfidence: number;
}

/** Stateful, deterministic rep counter. Same frame sequence in => same output. */
export interface RepEngine {
  readonly exercise: ExerciseKind;
  update(frame: PoseFrame): EngineUpdate;
  getState(): EngineState;
  summary(): SessionSummary;
  reset(): void;
}
