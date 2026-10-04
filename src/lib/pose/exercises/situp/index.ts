/** Sit-ups: engine in ./engine.ts, synthetic movement in ./synthetic.ts. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import { LM } from "@/lib/pose/landmarks";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";
import { SitupEngine } from "./engine";
import { situpSequence } from "./synthetic";

export { SitupEngine } from "./engine";

export function createEngine(overrides?: EngineConfigOverrides<"situp">): RepEngine {
  return new SitupEngine(resolveConfig("situp", overrides));
}

export const demo: ExerciseDemo = {
  frames: cachedFrames(() =>
    situpSequence({ fps: DEMO_FPS, width: DEMO_WIDTH, height: DEMO_HEIGHT, reps: 1, leadInMs: 450, leadOutMs: 350, repMs: 2000 }),
  ),
  // The engine judges the torso's rise from the floor (> 70 deg). Shoulder-hip-knee closes
  // below ~60 deg at the same moment with the default 80 deg knee bend, and is a joint triple
  // GuideDemo can draw.
  judged: { joints: [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE], label: "hip", good: (d) => d < 60 },
  layout: "floor",
};
