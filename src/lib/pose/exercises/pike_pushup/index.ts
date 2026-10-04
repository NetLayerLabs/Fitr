/** Pike push-ups: side-view engine (./engine.ts) and a perfect-form demo loop. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import { LM } from "@/lib/pose/landmarks";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";
import { PikePushupEngine } from "./engine";
import { pikeSequence } from "./synthetic";

export { PikePushupEngine } from "./engine";

export function createEngine(overrides?: EngineConfigOverrides<"pike_pushup">): RepEngine {
  return new PikePushupEngine(resolveConfig("pike_pushup", overrides));
}

export const demo: ExerciseDemo = {
  frames: cachedFrames(() =>
    pikeSequence({
      fps: DEMO_FPS,
      width: DEMO_WIDTH,
      height: DEMO_HEIGHT,
      reps: 1,
      leadInMs: 450,
      leadOutMs: 350,
      repMs: 2000,
      holdMs: 0,
    }),
  ),
  judged: { joints: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST], label: "elbow", good: (d) => d < 100 },
  layout: "floor",
};
