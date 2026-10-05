/**
 * Rep engine entry point: `createRepEngine(kind, overrides?)` returns a pure, deterministic
 * RepEngine (see src/lib/pose/types.ts) that turns PoseFrames into reps / hold time.
 * Every kind is delegated to its module in src/lib/pose/exercises/ (registry.ts); push-ups,
 * squats and planks are adapters over the engines in this folder.
 *
 * The anti-cheat notes below describe the push-up / squat / plank engines; each newer
 * exercise documents its own checks in its module folder.
 *
 * ANTI-CHEAT MEASURES (all client-side, all in this folder):
 *  - Counts only full human joint-angle cycles: e.g. push-up elbow > 155 deg -> < 90 deg ->
 *    > 155 deg; squat knee > 160 -> < 95 -> > 160. Shaking the phone moves the whole image,
 *    it does not bend a skeleton's elbows or knees, so it counts nothing.
 *  - Posture gates: push-ups and planks require a roughly horizontal body (shoulder->ankle
 *    line within 35 deg; standing arm curls count 0), a straight body line (sagging / piked
 *    hips rejected), straight legs (knee >= 160 / 165 deg: knee push-ups and knee planks fail,
 *    body_on_floor), and the body propped on the arms (wrist / elbow under the shoulder), which
 *    rejects lying on the floor and bending the arms. The ankle must be visible: there is no
 *    shoulder-hip-knee fallback, which could not tell knee variants apart. Squats must start
 *    from an upright stance, and the hip must drop at least 0.3 shin lengths (so seated knee
 *    extensions / one-legged knee bends fail).
 *  - Planted hands (push-ups): during a rep the wrist must stay within 0.15 body lengths of
 *    where it was at lockout, relative to the ankle. Pressing the hands through the air while
 *    the body stays still (e.g. filmed by a phone lying on its side, so a standing chest press
 *    looks like a push-up) is cancelled. This check does not depend on camera orientation.
 *  - Timing: reps faster than a human can do them with full range (push-up < 400 ms,
 *    squat < 500 ms) are rejected. Plank time is credited per frame interval; a frame after a
 *    stall (> 500 ms) earns at most 200 ms, so a stalled or throttled camera cannot inflate it.
 *    A short break in form is only forgiven after good form has been held again for 500 ms, so
 *    rhythmic "hip bobbing" earns only the time actually spent in good form.
 *  - Robust signal: aspect-corrected angles, One Euro smoothing, and debounced thresholds
 *    (>= 2 frames and >= 50 ms) with wide hysteresis, so tracking jitter cannot mint reps.
 *  - Tracking integrity: joints must be visible (>= 0.5); losing them for 300 ms, or a
 *    500 ms frame gap, abandons any rep in progress and the start position must be shown
 *    again; a joint "teleporting" > 25% of the frame height between frames freezes
 *    counting for 300 ms (unstable_tracking).
 *
 * LIMITS (be honest about these in product copy):
 *  - These checks raise the bar; they cannot prove that a live human did the reps on this
 *    device right now. A replayed or deep-faked video of a real workout pointed at the
 *    camera would pass, and so would a patched client that skips the engine and reports
 *    made-up numbers. Only server/onchain side attestation (e.g. hardware-backed device
 *    attestation, liveness challenges, or sampled pose-trace review) can narrow that gap.
 *  - 2D angles from one camera are view dependent. The thresholds assume a side view;
 *    a front view under-reads elbow / knee flexion and may reject valid reps.
 *  - The posture gates use the image axes, i.e. they assume the phone is upright. The engine
 *    cannot tell a still, sideways-filmed standing pose with the arms held out from a real
 *    straight-arm plank: the runtime gates frames on the device's gravity reading instead
 *    (runtime/orientation.ts; unavailable without an orientation sensor or, on iOS, without
 *    the motion permission). A wall push-up filmed at the matching roll is not detectable.
 *  - worldLandmarks are not used; everything runs on 2D image landmarks.
 *  - Thresholds are tuned against synthetic skeletons plus pose-model noise assumptions, not
 *    yet against a labelled dataset of real workouts.
 */
import { exerciseModule } from "@/lib/pose/exercises/registry";
import type { ExerciseKind, RepEngine } from "@/lib/pose/types";
import type { EngineConfigOverrides } from "./config";

/**
 * A fresh engine for `kind`, built by its exercise module (src/lib/pose/exercises/<kind>).
 * Throws for a value that is not an ExerciseKind (a programming error, not a frame error).
 */
export function createRepEngine<K extends ExerciseKind>(
  kind: K,
  overrides?: EngineConfigOverrides<K>,
): RepEngine {
  const mod = exerciseModule(kind);
  if (!mod) throw new Error(`Unknown exercise kind: ${String(kind)}`);
  return mod.createEngine(overrides);
}

export {
  COMMON_DEFAULTS,
  DEFAULT_ANGLE_FILTER,
  ENGINE_DEFAULTS,
  PLANK_DEFAULTS,
  PUSHUP_DEFAULTS,
  SQUAT_DEFAULTS,
  resolveConfig,
} from "./config";
export { EXERCISE_MODULES } from "@/lib/pose/exercises/registry";
export type {
  CommonEngineConfig,
  EngineConfig,
  EngineConfigMap,
  EngineConfigOverrides,
  PlankConfig,
  PushupConfig,
  SquatConfig,
} from "./config";
export { ISSUE_PRIORITY } from "./common";
export { PlankEngine } from "./plank";
export { PushupEngine } from "./pushup";
export { SquatEngine } from "./squat";
