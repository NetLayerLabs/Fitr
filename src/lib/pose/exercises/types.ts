/**
 * Contract every exercise module (src/lib/pose/exercises/<kind>/index.ts) implements.
 * See README.md in this folder.
 */
import type { EngineConfigOverrides } from "@/lib/pose/engine/config";
import type { ExerciseKind, PoseFrame, RepEngine } from "@/lib/pose/types";

/** The joint angle the form-guide demo labels (e.g. the elbow for push-ups). */
export interface JudgedAngle {
  /** Landmark indices [a, vertex, c]; the angle is measured at the vertex. */
  joints: [number, number, number];
  /** Short label drawn next to the vertex, e.g. "elbow". */
  label: string;
  /** True when this angle is the one the engine is looking for (drawn highlighted, with a tick). */
  good(deg: number): boolean;
}

/** Animated skeleton shown in the form guide until a verified stock clip exists. */
export interface ExerciseDemo {
  /**
   * One clean, perfect-form loop (about 2-4 s), 30 fps, rendered with the same synthetic
   * skeletons the engine is tested against. Should cache: it is called on every guide mount.
   */
  frames(): PoseFrame[];
  /** The angle to label, or null to draw the skeleton only. */
  judged: JudgedAngle | null;
  /** How the body is framed: lying / propped along the floor, or upright. */
  layout: "floor" | "standing";
}

export interface ExerciseModule<K extends ExerciseKind = ExerciseKind> {
  /** A fresh, pure, deterministic engine with `overrides` merged over this exercise's defaults. */
  createEngine(overrides?: EngineConfigOverrides<K>): RepEngine;
  demo: ExerciseDemo;
}
