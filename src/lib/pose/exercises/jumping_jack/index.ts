/** Jumping jacks (front view). Engine: ./engine.ts; synthetic movement: ./synthetic.ts. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import { LM } from "@/lib/pose/landmarks";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";
import { JUMPING_JACK_DEFAULTS } from "./config";
import { JumpingJackEngine } from "./engine";
import { jumpingJackSequence } from "./synthetic";

export function createEngine(overrides?: EngineConfigOverrides<"jumping_jack">): RepEngine {
  return new JumpingJackEngine(resolveConfig("jumping_jack", overrides));
}

export const demo: ExerciseDemo = {
  frames: cachedFrames(() =>
    jumpingJackSequence({
      fps: DEMO_FPS,
      width: DEMO_WIDTH,
      height: DEMO_HEIGHT,
      reps: 1,
      repMs: 1400,
      bottomHoldMs: 200,
      holdMs: 0,
      leadInMs: 500,
      leadOutMs: 400,
    }),
  ),
  // Arm angle at the shoulder: the engine wants both arms past 140 deg (hands above the head).
  judged: {
    joints: [LM.LEFT_HIP, LM.LEFT_SHOULDER, LM.LEFT_WRIST],
    label: "arm",
    good: (d) => d >= JUMPING_JACK_DEFAULTS.openArmDeg,
  },
  layout: "standing",
};
