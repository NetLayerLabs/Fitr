/** Jump squats: side view; squat to depth, then both feet must leave the floor. Engine in ./engine.ts. */
import { resolveConfig, type EngineConfigOverrides } from "@/lib/pose/engine/config";
import { LM } from "@/lib/pose/landmarks";
import type { RepEngine } from "@/lib/pose/types";
import { cachedFrames, DEMO_FPS, DEMO_HEIGHT, DEMO_WIDTH } from "../demo";
import type { ExerciseDemo } from "../types";
import { JUMP_SQUAT_DEFAULTS } from "./config";
import { JumpSquatEngine } from "./engine";
import { jumpSquatSequence } from "./synthetic";

export function createEngine(overrides?: EngineConfigOverrides<"jump_squat">): RepEngine {
  return new JumpSquatEngine(resolveConfig("jump_squat", overrides));
}

/** One jump squat: squat, jump, soft landing, stand. */
export const demo: ExerciseDemo = {
  frames: cachedFrames(() =>
    jumpSquatSequence({ fps: DEMO_FPS, width: DEMO_WIDTH, height: DEMO_HEIGHT, reps: 1, leadInMs: 450, leadOutMs: 250 }),
  ),
  judged: {
    joints: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
    label: "knee",
    good: (d) => d < JUMP_SQUAT_DEFAULTS.downAngleDeg,
  },
  layout: "standing",
};
