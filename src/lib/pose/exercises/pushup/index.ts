/** Push-ups: adapter over the original engine in src/lib/pose/engine/pushup.ts. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import { PushupEngine } from "@/lib/pose/engine/pushup";
import { LM } from "@/lib/pose/landmarks";
import { pushupSequence } from "@/lib/pose/testing/synthetic";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";

export function createEngine(overrides?: EngineConfigOverrides<"pushup">): RepEngine {
  return new PushupEngine(resolveConfig("pushup", overrides));
}

export const demo: ExerciseDemo = {
  frames: cachedFrames(() =>
    pushupSequence({
      fps: DEMO_FPS,
      width: DEMO_WIDTH,
      height: DEMO_HEIGHT,
      reps: 1,
      leadInMs: 450,
      leadOutMs: 350,
      repMs: 1800,
    }),
  ),
  judged: { joints: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST], label: "elbow", good: (d) => d < 90 },
  layout: "floor",
};
