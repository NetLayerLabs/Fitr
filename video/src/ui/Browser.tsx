import React from "react";
import { OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import footage from "../footage.json";
import { C, mono } from "../theme";
import { clamp, soft } from "./motion";

export interface Rect { x: number; y: number; w: number; h: number }
const LIB = footage as unknown as Record<string, { file: string }>;
/** The page the desktop footage was recorded at, in CSS pixels. */
export const PAGE = { w: 1600, h: 900 };

/**
 * A browser window playing a desktop recording of the live site. Between `focusAt[0]` and
 * `focusAt[1]` the camera moves from the whole page to `focus` (page CSS px) at `zoom`×.
 */
export const Browser: React.FC<{
  name: string; url: string; width: number; left: number; top: number; startFrom?: number; rate?: number;
  focus?: Rect; zoom?: number; focusAt?: [number, number]; enter?: number;
}> = ({ name, url, width, left, top, startFrom = 0, rate = 1, focus, zoom = 1.8, focusAt = [0, 1], enter = 0 }) => {
  const f = useCurrentFrame();
  const bar = 46;
  const vh = (width * PAGE.h) / PAGE.w;
  const k = width / PAGE.w;
  const p = focus ? interpolate(f, focusAt, [0, 1], { ...clamp, easing: soft }) : 0;
  const s = 1 + (zoom - 1) * p;
  const cx = focus ? focus.x + focus.w / 2 : PAGE.w / 2;
  const cy = focus ? focus.y + focus.h / 2 : PAGE.h / 2;
  const tx = Math.min(0, Math.max(width - PAGE.w * k * s, width / 2 - cx * k * s)) * (p > 0 ? 1 : 0);
  const ty = Math.min(0, Math.max(vh - PAGE.h * k * s, vh / 2 - cy * k * s)) * (p > 0 ? 1 : 0);
  const inP = interpolate(f, [enter, enter + 18], [0, 1], { ...clamp, easing: soft });
  const clip = LIB[name];
  return (
    <div style={{
      position: "absolute", left, top, width, height: vh + bar, borderRadius: 20, overflow: "hidden", background: C.surface,
      boxShadow: "0 0 0 1px rgba(10,11,13,0.14), 0 40px 90px rgba(10,11,13,0.28)", opacity: inP, transform: `translateY(${(1 - inP) * 40}px)`,
    }}>
      <div style={{ height: bar, display: "flex", alignItems: "center", gap: 9, padding: "0 18px", background: "#1A1D21", borderBottom: "1px solid #2C3036" }}>
        {["#F26B5E", "#F5BE4F", "#5BC560"].map((col) => <span key={col} style={{ width: 12, height: 12, borderRadius: 6, background: col }} />)}
        <div style={{ marginLeft: 18, flex: 1, height: 28, borderRadius: 14, background: "#24282D", display: "flex", alignItems: "center", padding: "0 14px", fontFamily: mono, fontSize: 15, color: C.muted }}>{url}</div>
      </div>
      <div style={{ position: "relative", width, height: vh, overflow: "hidden", background: C.ink }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: PAGE.w, height: PAGE.h, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${k * s})` }}>
          {clip ? <OffthreadVideo src={staticFile(clip.file)} startFrom={startFrom} playbackRate={rate} muted style={{ width: PAGE.w, height: PAGE.h }} /> : null}
        </div>
      </div>
    </div>
  );
};
