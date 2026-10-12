import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, mono } from "../theme";
import { clamp, expo } from "./motion";

/**
 * The film's motif: the pose lines Fitr's AI sees. Joints are traced from the athlete photos
 * (public/art/*-man.jpg, 960x960, side-on), so the figure sits exactly on the photo at p = 0
 * (standing) and p = 1 (squat bottom). Blending between them performs a rep.
 */
type Pt = [number, number];
type Body = { ear: Pt; shoulder: Pt; elbow: Pt; wrist: Pt; hip: Pt; knee: Pt; ankle: Pt; toe: Pt };
const STAND: Body = { ear: [478, 92], shoulder: [440, 182], elbow: [446, 330], wrist: [500, 478], hip: [452, 440], knee: [440, 642], ankle: [420, 838], toe: [505, 884] };
const SQUAT: Body = { ear: [470, 212], shoulder: [452, 328], elbow: [585, 452], wrist: [712, 560], hip: [322, 560], knee: [552, 518], ankle: [452, 742], toe: [545, 792] };
/** Arm straight up (the live check), from the standing pose. */
const RAISE = { elbow: [452, 72] as Pt, wrist: [466, -40] as Pt };
const BONES: [keyof Body, keyof Body][] = [["ear", "shoulder"], ["shoulder", "elbow"], ["elbow", "wrist"], ["shoulder", "hip"], ["hip", "knee"], ["knee", "ankle"], ["ankle", "toe"]];

const mix = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export function bodyAt(p: number, raise = 0): Body {
  const out = {} as Body;
  for (const k of Object.keys(STAND) as (keyof Body)[]) out[k] = mix(STAND[k], SQUAT[k], p);
  if (raise > 0) {
    out.elbow = mix(out.elbow, RAISE.elbow, raise);
    out.wrist = mix(out.wrist, RAISE.wrist, raise);
  }
  return out;
}
export const kneeAngle = (b: Body) => {
  const v1 = [b.hip[0] - b.knee[0], b.hip[1] - b.knee[1]];
  const v2 = [b.ankle[0] - b.knee[0], b.ankle[1] - b.knee[1]];
  const c = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]));
  return Math.round((Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI);
};

/** Squat depth over time for `reps` reps between frames a and b (0 stand -> depth -> 0). */
export const repCurve = (f: number, a: number, b: number, reps: number, depth = 1) => {
  if (f <= a || f >= b) return 0;
  const t = ((f - a) / (b - a)) * reps;
  const ph = t - Math.floor(t);
  return depth * (0.5 - 0.5 * Math.cos(ph * Math.PI * 2));
};
export const repsDone = (f: number, a: number, b: number, reps: number) => (f <= a ? 0 : f >= b ? reps : Math.floor(((f - a) / (b - a)) * reps + 0.5));

/**
 * The pose figure in the photo's 960x960 space, drawn at `size` px. `draw` (0-1) traces the
 * bones in, `p` is squat depth, `raise` lifts the arm, `angle` shows the knee angle readout.
 */
export const Pose: React.FC<{
  size: number; p?: number; raise?: number; draw?: number; color?: string; angle?: boolean; angleColor?: string;
  glow?: boolean; dots?: boolean; strokeScale?: number; label?: string;
}> = ({ size, p = 0, raise = 0, draw = 1, color = C.lime, angle = false, angleColor, glow = true, dots = true, strokeScale = 1, label }) => {
  const b = bodyAt(p, raise);
  const deg = kneeAngle(b);
  const sw = 7 * strokeScale;
  const n = BONES.length;
  // Knee arc between thigh and shin.
  const a1 = Math.atan2(b.hip[1] - b.knee[1], b.hip[0] - b.knee[0]);
  const a2 = Math.atan2(b.ankle[1] - b.knee[1], b.ankle[0] - b.knee[0]);
  const r = 62;
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const arc = `M ${b.knee[0] + r * Math.cos(a1)} ${b.knee[1] + r * Math.sin(a1)} A ${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${b.knee[0] + r * Math.cos(a2)} ${b.knee[1] + r * Math.sin(a2)}`;
  const ac = angleColor ?? color;
  return (
    <svg width={size} height={size} viewBox="0 0 960 960" style={{ overflow: "visible", position: "absolute", left: 0, top: 0 }}>
      {glow ? (
        <filter id="poseGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      ) : null}
      <g filter={glow ? "url(#poseGlow)" : undefined} strokeLinecap="round">
        {BONES.map(([from, to], i) => {
          const t = Math.max(0, Math.min(1, draw * n - i));
          if (t <= 0) return null;
          const e = mix(b[from], b[to], t);
          return <line key={i} x1={b[from][0]} y1={b[from][1]} x2={e[0]} y2={e[1]} stroke={color} strokeWidth={sw} />;
        })}
        {dots
          ? (Object.keys(b) as (keyof Body)[]).map((k, i) => {
              const t = Math.max(0, Math.min(1, draw * (n + 1) - i));
              return t > 0 ? <circle key={k} cx={b[k][0]} cy={b[k][1]} r={(k === "ear" ? 16 : 12) * strokeScale * t} fill={C.ink} stroke={color} strokeWidth={5 * strokeScale} /> : null;
            })
          : null}
      </g>
      {angle && draw >= 1 ? (
        <g>
          <path d={arc} fill="none" stroke={ac} strokeWidth={5} strokeDasharray="2 10" strokeLinecap="round" />
          <text x={b.knee[0] + 84} y={b.knee[1] - 30} fill={ac} fontFamily={mono} fontSize={44} fontWeight={500}>{deg}°</text>
        </g>
      ) : null}
      {label ? <text x={480} y={940} textAnchor="middle" fill={color} fontFamily={mono} fontSize={34} letterSpacing="2">{label}</text> : null}
    </svg>
  );
};

/** A traced-in reveal for the photo + figure pair (used by the open). */
export const drawIn = (f: number, at: number, dur = 40) => interpolate(f, [at, at + dur], [0, 1], { ...clamp, easing: expo });
