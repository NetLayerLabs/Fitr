/** Burpees (side view). Engine: ./engine.ts; synthetic movement: ./synthetic.ts. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";
import { BurpeeEngine } from "./engine";
import { burpeeSequence } from "./synthetic";

export function createEngine(overrides?: EngineConfigOverrides<"burpee">): RepEngine {
  return new BurpeeEngine(resolveConfig("burpee", overrides));
}

export const demo: ExerciseDemo = {
  // Full sequence: squat, kick back to a plank, push-up, squat, jump with arms up.
  frames: cachedFrames(() =>
    burpeeSequence({
      fps: DEMO_FPS,
      width: DEMO_WIDTH,
      height: DEMO_HEIGHT,
      reps: 1,
      repMs: 3200,
      holdMs: 0,
      pushup: true,
      leadInMs: 500,
      leadOutMs: 400,
    }),
  ),
  // A sequence of positions, not one angle: draw the skeleton only.
  judged: null,
  layout: "standing",
};
