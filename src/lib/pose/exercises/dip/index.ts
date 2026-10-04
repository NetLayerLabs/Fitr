/** Dips (bench / chair or bars): side-view engine (./engine.ts) and a perfect-form demo loop. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import { LM } from "@/lib/pose/landmarks";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";
import { DipEngine } from "./engine";
import { dipSequence } from "./synthetic";

export { DipEngine } from "./engine";

export function createEngine(overrides?: EngineConfigOverrides<"dip">): RepEngine {
  return new DipEngine(resolveConfig("dip", overrides));
}

export const demo: ExerciseDemo = {
  frames: cachedFrames(() =>
    dipSequence({
      fps: DEMO_FPS,
      width: DEMO_WIDTH,
      height: DEMO_HEIGHT,
      style: "bench",
      reps: 1,
      leadInMs: 450,
      leadOutMs: 350,
      repMs: 2000,
      holdMs: 0,
    }),
  ),
  judged: { joints: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST], label: "elbow", good: (d) => d <= 90 },
  layout: "standing",
};
