/** Helpers for building ExerciseDemo objects. */
import type { PoseFrame } from "@/lib/pose/types";

/** Demo frames are rendered for a 4:3 canvas; GuideDemo scales them to the element. */
export const DEMO_WIDTH = 640;
export const DEMO_HEIGHT = 480;
export const DEMO_FPS = 30;

/** Memoises a frame builder so the (deterministic) sequence is generated once per page. */
export function cachedFrames(build: () => PoseFrame[]): () => PoseFrame[] {
  let cache: PoseFrame[] | null = null;
  return () => (cache ??= build());
}
