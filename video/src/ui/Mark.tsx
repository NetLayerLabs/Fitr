import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { clamp, expo } from "./motion";

/**
 * The Fitr mark, redrawn from public/brand/fitr-mark.png (512x451) as two SVG shapes so each
 * can slide in: the lime top bar, then the white F body.
 */
export const Mark: React.FC<{ size?: number; at?: number; bodyColor?: string; barColor?: string }> = ({ size = 120, at, bodyColor = C.text, barColor = C.lime }) => {
  const f = useCurrentFrame();
  const a = at == null ? 1 : interpolate(f, [at, at + 16], [0, 1], { ...clamp, easing: expo });
  const b = at == null ? 1 : interpolate(f, [at + 6, at + 24], [0, 1], { ...clamp, easing: expo });
  return (
    <svg width={size} height={(size * 451) / 512} viewBox="0 0 512 451" style={{ overflow: "visible" }}>
      <path d="M100 130 L121 62 Q140 0 212 0 L512 0 L466 130 Z" fill={barColor} style={{ opacity: a, transform: `translate(${(1 - a) * 80}px, 0)` }} />
      <path d="M92 166 L442 166 L403 279 L214 279 L161 451 L0 451 L80 178 Q84 166 92 166 Z" fill={bodyColor} style={{ opacity: b, transform: `translate(${(1 - b) * -60}px, ${(1 - b) * 30}px)` }} />
    </svg>
  );
};
