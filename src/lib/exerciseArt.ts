import type { ExerciseKind } from "@/lib/pose/types";
import type { Demonstrator } from "@/lib/formGuide";
import EN from "@/lib/i18n/messages/en/exercises";

/**
 * Hero photography per exercise (AI-generated, one consistent athlete per demonstrator), served
 * from /public/art/exercises. `src` is ~960 px for headers; `thumb` is ~420 px for cards.
 * Photos illustrate the pose; the animated demo in the form guide shows the exact movement.
 */
export interface ExerciseArt {
  src: string;
  thumb: string;
  /**
   * English alt text. Screens show it translated with artAlt(t, art.kind) from
   * src/lib/i18n/exercise.ts (ArtPhoto does this itself).
   */
  alt: string;
  /** The exercise shown, or null for the neutral standing portrait (picks the alt text key). */
  kind: ExerciseKind | null;
  /**
   * "floor": the athlete stays in the lower ~65% of the square (push-up, plank...), so wide
   * headers may crop the empty top (anchor the image to the bottom). "full": the pose uses the
   * whole height (pull-up, jumping jack...), show the square uncropped.
   */
  framing: "floor" | "full";
}

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
    alt: EN[`${kind}_photoAlt`],
    kind,
    framing: FLOOR_POSES.has(kind) ? "floor" : "full",
  };
}

/** Neutral standing portrait, for empty states and onboarding. */
export const STANDING_ART: ExerciseArt = {
  src: "/art/exercises/stand-man.jpg",
  thumb: "/art/exercises/stand-man-sm.jpg",
  alt: EN.standingPhotoAlt,
  kind: null,
  framing: "full",
};
