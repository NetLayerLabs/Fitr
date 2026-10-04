/** Squats: adapter over the original engine in src/lib/pose/engine/squat.ts. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import { SquatEngine } from "@/lib/pose/engine/squat";
import { LM } from "@/lib/pose/landmarks";
import { squatSequence } from "@/lib/pose/testing/synthetic";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";

export function createEngine(overrides?: EngineConfigOverrides<"squat">): RepEngine {
  return new SquatEngine(resolveConfig("squat", overrides));
}

export const demo: ExerciseDemo = {
  frames: cachedFrames(() =>
    squatSequence({
      fps: DEMO_FPS,
      width: DEMO_WIDTH,
      height: DEMO_HEIGHT,
      reps: 1,
      leadInMs: 450,
      leadOutMs: 350,
      repMs: 2200,
      holdMs: 0,
    }),
  ),
  judged: { joints: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE], label: "knee", good: (d) => d < 95 },
  layout: "standing",
};
