import type { ExerciseKind } from "@/lib/pose/types";
import type { Demonstrator } from "@/lib/formGuide";

/**
 * Hero photography per exercise (AI-generated, one consistent athlete per demonstrator), served
 * from /public/art/exercises. `src` is ~960 px for headers; `thumb` is ~420 px for cards.
 * Photos illustrate the pose; the animated demo in the form guide shows the exact movement.
 */
export interface ExerciseArt {
  src: string;
  thumb: string;
  alt: string;
  /**
   * "floor": the athlete stays in the lower ~65% of the square (push-up, plank...), so wide
   * headers may crop the empty top (anchor the image to the bottom). "full": the pose uses the
   * whole height (pull-up, jumping jack...), show the square uncropped.
   */
  framing: "floor" | "full";
}

const POSE_ALT: Record<ExerciseKind, string> = {
  pushup: "at the bottom of a push-up, body in a straight line",
  squat: "at the bottom of a deep bodyweight squat",
  plank: "holding a forearm plank",
  lunge: "in a deep lunge, back knee just above the floor",
  situp: "sitting up during a sit-up",
  leg_raise: "lying on his back with straight legs raised to vertical",
  glute_bridge: "in a glute bridge, hips raised",
  wall_sit: "in a wall sit, back against the wall, thighs level",
  pike_pushup: "in a pike push-up, hips high, head lowering to the floor",
  jump_squat: "in the air during a jump squat",
  pullup: "at the top of a pull-up, chin over the bar",
  dip: "doing a dip on a bench",
  burpee: "jumping with arms overhead at the end of a burpee",
  mountain_climber: "driving a knee to his chest in a mountain climber",
  jumping_jack: "mid jumping jack, arms overhead and feet wide",
  high_knees: "running in place, knee at hip height",
};

/** Poses that sit low in the frame; checked against the actual photos. */
const FLOOR_POSES: ReadonlySet<ExerciseKind> = new Set<ExerciseKind>([
  "pushup",
  "plank",
  "glute_bridge",
  "mountain_climber",
  "pike_pushup",
  "situp",
]);

/** Demonstrators with a full photo set. Add "woman" when her images land. */
export const ART_DEMONSTRATORS: readonly Demonstrator[] = ["man"];

export function exerciseArt(kind: ExerciseKind, who: Demonstrator = "man"): ExerciseArt | null {
  if (!ART_DEMONSTRATORS.includes(who)) return null;
  const base = `/art/exercises/${kind}-${who}`;
  return {
    src: `${base}.jpg`,
    thumb: `${base}-sm.jpg`,
    alt: `Athlete ${POSE_ALT[kind]}`,
    framing: FLOOR_POSES.has(kind) ? "floor" : "full",
  };
}

/** Neutral standing portrait, for empty states and onboarding. */
export const STANDING_ART: ExerciseArt = {
  src: "/art/exercises/stand-man.jpg",
  thumb: "/art/exercises/stand-man-sm.jpg",
  alt: "Athlete standing, ready to train",
  framing: "full",
};
