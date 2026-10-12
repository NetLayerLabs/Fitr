import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { T } from "../timing";
import { SCENE_TONE, TONE } from "../theme";
import { clamp } from "./motion";
import { NetLayer } from "./NetLayer";

/** The one piece of corner furniture: "Built by NetLayer Labs", bottom right, tinted per scene. */
export const Chrome: React.FC<{ hideAfter?: number }> = ({ hideAfter }) => {
  const f = useCurrentFrame();
  const sc = T.scenes.find((s) => f >= s.from && f < s.from + s.durationInFrames) ?? T.scenes[T.scenes.length - 1];
  const tone = TONE[SCENE_TONE[sc.id] ?? "night"];
  const op = hideAfter != null ? interpolate(f, [hideAfter, hideAfter + 12], [1, 0], clamp) : 1;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <NetLayer height={20} dark={SCENE_TONE[sc.id] !== "night"} labelColor={tone.muted} style={{ position: "absolute", right: 52, bottom: 30, opacity: op }} />
    </AbsoluteFill>
  );
};
