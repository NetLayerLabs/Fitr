/** Leg raises: engine in ./engine.ts, synthetic movement in ./synthetic.ts. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import { LM } from "@/lib/pose/landmarks";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";
import { LEG_RAISE_DEFAULTS } from "./config";
import { LegRaiseEngine } from "./engine";
import { legRaiseSequence } from "./synthetic";

export { LegRaiseEngine } from "./engine";

export function createEngine(overrides?: EngineConfigOverrides<"leg_raise">): RepEngine {
  return new LegRaiseEngine(resolveConfig("leg_raise", overrides));
}

export const demo: ExerciseDemo = {
  frames: cachedFrames(() =>
    legRaiseSequence({ fps: DEMO_FPS, width: DEMO_WIDTH, height: DEMO_HEIGHT, reps: 1, leadInMs: 450, leadOutMs: 350, repMs: 2400 }),
  ),
  judged: {
    joints: [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_ANKLE],
    label: "hip",
    good: (d) => d < LEG_RAISE_DEFAULTS.downAngleDeg,
  },
  layout: "floor",
};
