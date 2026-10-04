/** Wall sit: side view, timed hold (seconds). Engine in ./engine.ts. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import { LM } from "@/lib/pose/landmarks";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";
import { WALL_SIT_DEFAULTS } from "./config";
import { WallSitEngine } from "./engine";
import { wallSitSequence } from "./synthetic";

export function createEngine(overrides?: EngineConfigOverrides<"wall_sit">): RepEngine {
  return new WallSitEngine(resolveConfig("wall_sit", overrides));
}

/** ~3 s held wall sit: knees 90 deg, thighs level, back upright. */
export const demo: ExerciseDemo = {
  frames: cachedFrames(() => wallSitSequence({ durationMs: 3000, fps: DEMO_FPS, width: DEMO_WIDTH, height: DEMO_HEIGHT })),
  judged: {
    joints: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
    label: "knee",
    good: (d) => d >= WALL_SIT_DEFAULTS.minKneeDeg && d <= WALL_SIT_DEFAULTS.maxKneeDeg,
  },
  layout: "standing",
};
