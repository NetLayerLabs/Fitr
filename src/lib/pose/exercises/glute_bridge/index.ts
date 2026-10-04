/** Glute bridges: engine in ./engine.ts, synthetic movement in ./synthetic.ts. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import { LM } from "@/lib/pose/landmarks";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";
import { GLUTE_BRIDGE_DEFAULTS } from "./config";
import { GluteBridgeEngine } from "./engine";
import { bridgeSequence } from "./synthetic";

export { GluteBridgeEngine, signedHipExtensionDeg } from "./engine";

export function createEngine(overrides?: EngineConfigOverrides<"glute_bridge">): RepEngine {
  return new GluteBridgeEngine(resolveConfig("glute_bridge", overrides));
}

export const demo: ExerciseDemo = {
  frames: cachedFrames(() =>
    bridgeSequence({
      fps: DEMO_FPS,
      width: DEMO_WIDTH,
      height: DEMO_HEIGHT,
      reps: 1,
      leadInMs: 450,
      leadOutMs: 350,
      repMs: 1800,
      bottomHoldMs: 500,
    }),
  ),
  // GuideDemo draws the unsigned angle; the demo never over-arches, so they agree.
  judged: {
    joints: [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE],
    label: "hip",
    good: (d) => d > GLUTE_BRIDGE_DEFAULTS.topMinDeg,
  },
  layout: "floor",
};
