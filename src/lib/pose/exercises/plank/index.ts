/** Plank: adapter over the original engine in src/lib/pose/engine/plank.ts. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import { PlankEngine } from "@/lib/pose/engine/plank";
import { LM } from "@/lib/pose/landmarks";
import { plankSequence } from "@/lib/pose/testing/synthetic";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";

export function createEngine(overrides?: EngineConfigOverrides<"plank">): RepEngine {
  return new PlankEngine(resolveConfig("plank", overrides));
}

export const demo: ExerciseDemo = {
  frames: cachedFrames(() =>
    plankSequence({ durationMs: 3000, style: "forearm", fps: DEMO_FPS, width: DEMO_WIDTH, height: DEMO_HEIGHT }),
  ),
  judged: { joints: [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_ANKLE], label: "body line", good: (d) => d > 160 },
  layout: "floor",
};
