/** Lunges: side view, each lunge (either leg) counts 1 rep. Engine in ./engine.ts. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import { LM } from "@/lib/pose/landmarks";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";
import { LUNGE_DEFAULTS } from "./config";
import { LungeEngine } from "./engine";
import { lungeSequence } from "./synthetic";

export function createEngine(overrides?: EngineConfigOverrides<"lunge">): RepEngine {
  return new LungeEngine(resolveConfig("lunge", overrides));
}

/** One full lunge, the near (left, highlighted) leg in front. */
export const demo: ExerciseDemo = {
  frames: cachedFrames(() =>
    lungeSequence({
      fps: DEMO_FPS,
      width: DEMO_WIDTH,
      height: DEMO_HEIGHT,
      reps: 1,
      frontLeg: "near",
      leadInMs: 450,
      leadOutMs: 350,
      repMs: 2200,
      bottomHoldMs: 250,
      holdMs: 0,
    }),
  ),
  judged: {
    joints: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
    label: "front knee",
    good: (d) => d < LUNGE_DEFAULTS.downAngleDeg,
  },
  layout: "standing",
};
