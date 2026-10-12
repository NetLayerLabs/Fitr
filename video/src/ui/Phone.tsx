import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import footage from "../footage.json";
import device from "../device.json";
import { C, mono } from "../theme";
import { clamp, soft } from "./motion";

/** Real app clips recorded by scripts/capture.mjs (app.fitr.day, live mainnet data, 1170x2532). */
export interface Clip { file: string; width: number; height: number; durationFrames: number; marks?: Record<string, number> }
const LIB = footage as unknown as Record<string, Clip>;
/** Seeker screen recordings (scripts/device.mjs): slot -> file, trim and speed. */
export interface DeviceClip { file: string; startFrom?: number; rate?: number; speedLabel?: string; volume?: number }
const DEV = device as unknown as Record<string, DeviceClip | null>;
export const hasDevice = (slot: string) => !!DEV[slot]?.file;

export type Source =
  | { footage: string; startFrom?: number; rate?: number }
  | { device: string; fallback?: { footage: string; startFrom?: number; rate?: number } }
  | { still: string };

/**
 * A phone (Seeker-like proportions, 9:20 screen) playing the real app. A `device` source is a
 * Seeker screen recording; until it exists, the fallback plays with a visible "placeholder" tag.
 */
export const Phone: React.FC<{
  src: Source; height: number; left: number; top: number; enter?: number; /** Frames into the clip (continuing a clip across scenes). */ offset?: number; tilt?: number; float?: boolean; shadow?: string; tag?: string;
}> = ({ src, height, left, top, enter = 0, offset = 0, tilt = 0, float = true, shadow, tag }) => {
  const f = useCurrentFrame();
  const width = height * (9 / 20) + 24;
  const p = interpolate(f, [enter, enter + 22], [0, 1], { ...clamp, easing: soft });
  const bob = float ? Math.sin(f / 38) * 5 : 0;
  let body: React.ReactNode = null;
  let placeholder = false;
  let speed: string | undefined;
  const vid = (s: { file: string; startFrom?: number; rate?: number; volume?: number }) => (
    <OffthreadVideo src={staticFile(s.file)} startFrom={(s.startFrom ?? 0) + Math.round(offset * (s.rate ?? 1))} playbackRate={s.rate ?? 1} muted={!s.volume} volume={s.volume ?? 0} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
  );
  if ("still" in src) body = <Img src={staticFile(src.still)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />;
  else if ("footage" in src) body = LIB[src.footage] ? vid({ ...src, file: LIB[src.footage].file }) : null;
  else {
    const d = DEV[src.device];
    if (d?.file) {
      body = vid(d);
      speed = d.speedLabel;
    } else if (src.fallback && LIB[src.fallback.footage]) {
      body = vid({ ...src.fallback, file: LIB[src.fallback.footage].file });
      placeholder = true;
    } else placeholder = true;
  }
  return (
    <div style={{
      position: "absolute", left, top: top + bob + (1 - p) * 60, width, height: height + 24, borderRadius: 58, padding: 12,
      background: "linear-gradient(160deg, #2A2E33, #0B0C0E 60%)", opacity: p,
      boxShadow: shadow ?? `0 0 0 1.5px rgba(255,255,255,0.08), 0 50px 120px rgba(0,0,0,0.6), 0 0 90px ${C.limeDim}`,
      transform: `perspective(2600px) rotateY(${tilt * (1 - p * 0.4)}deg)`,
    }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 46, overflow: "hidden", background: C.ink }}>
        {body}
        <div style={{ position: "absolute", top: 14, left: "50%", width: 16, height: 16, marginLeft: -8, borderRadius: 8, background: "#000", boxShadow: "0 0 0 2px #1b1d20" }} />
        {placeholder ? (
          <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: 18 }}>
            <div style={{ fontFamily: mono, fontSize: 15, color: C.ink, background: C.amber, padding: "6px 12px", borderRadius: 8, letterSpacing: "0.04em" }}>PLACEHOLDER · SEEKER CLIP “{"device" in src ? src.device : ""}”</div>
          </AbsoluteFill>
        ) : null}
      </div>
      {speed || tag ? (
        <div style={{ position: "absolute", right: -14, top: 40, fontFamily: mono, fontSize: 16, color: C.ink, background: C.lime, padding: "6px 12px", borderRadius: 999 }}>{speed ?? tag}</div>
      ) : null}
    </div>
  );
};
