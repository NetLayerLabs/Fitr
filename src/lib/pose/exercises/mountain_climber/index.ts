/** Mountain climbers: engine in ./engine.ts, synthetic movement in ./synthetic.ts. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import { LM } from "@/lib/pose/landmarks";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";
import { MOUNTAIN_CLIMBER_DEFAULTS } from "./config";
import { MountainClimberEngine } from "./engine";
import { climberSequence } from "./synthetic";

export { MountainClimberEngine } from "./engine";

export function createEngine(overrides?: EngineConfigOverrides<"mountain_climber">): RepEngine {
  return new MountainClimberEngine(resolveConfig("mountain_climber", overrides));
}

export const demo: ExerciseDemo = {
  // One loop = one drive per leg (near leg first): the engine counts 2.
  frames: cachedFrames(() =>
    climberSequence({ fps: DEMO_FPS, width: DEMO_WIDTH, height: DEMO_HEIGHT, drives: 2, driveMs: 900, leadInMs: 450, leadOutMs: 350 }),
  ),
  judged: {
    joints: [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE],
    label: "hip",
    good: (d) => d < MOUNTAIN_CLIMBER_DEFAULTS.downAngleDeg,
  },
  layout: "floor",
};
