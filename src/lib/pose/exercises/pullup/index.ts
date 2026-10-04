/** Pull-ups: front-view engine (./engine.ts) and a perfect-form demo loop. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import { LM } from "@/lib/pose/landmarks";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";
import { PullupEngine } from "./engine";
import { pullupSequence } from "./synthetic";

export { PullupEngine } from "./engine";

export function createEngine(overrides?: EngineConfigOverrides<"pullup">): RepEngine {
  return new PullupEngine(resolveConfig("pullup", overrides));
}

export const demo: ExerciseDemo = {
  frames: cachedFrames(() =>
    pullupSequence({
      fps: DEMO_FPS,
      width: DEMO_WIDTH,
      height: DEMO_HEIGHT,
      reps: 1,
      leadInMs: 450,
      leadOutMs: 350,
      repMs: 2400,
      holdMs: 0,
    }),
  ),
  // Front view: the near (highlighted) side is the person's left, on the right of the image.
  judged: { joints: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST], label: "elbow", good: (d) => d < 90 },
  layout: "standing",
};
