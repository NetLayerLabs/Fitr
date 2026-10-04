/** High knees (front view). Engine: ./engine.ts; synthetic movement: ./synthetic.ts. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";
import { HighKneesEngine } from "./engine";
import { highKneesSequence } from "./synthetic";

export function createEngine(overrides?: EngineConfigOverrides<"high_knees">): RepEngine {
  return new HighKneesEngine(resolveConfig("high_knees", overrides));
}

export const demo: ExerciseDemo = {
  // One left + one right knee drive (2 reps): the loop alternates like the real movement.
  frames: cachedFrames(() =>
    highKneesSequence({
      fps: DEMO_FPS,
      width: DEMO_WIDTH,
      height: DEMO_HEIGHT,
      lifts: 2,
      liftMs: 800,
      gapMs: 120,
      leadInMs: 500,
      leadOutMs: 400,
    }),
  ),
  // The knee is raised towards the camera, so no single 2D joint angle shows the movement.
  judged: null,
  layout: "standing",
};
