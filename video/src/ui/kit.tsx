import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { scene, wordAt, lineStart, lineEnd } from "../timing";
import { C, display, inter, mono, TONE, type Tone } from "../theme";
import { clamp, expo, pop } from "./motion";

/** Scene-local timing: frame `f` from the scene start, and word / line times in the same frame. */
export const useScene = (id: string) => {
  const f = useCurrentFrame();
  const s = scene(id);
  return {
    f,
    dur: s.durationInFrames,
    w: (word: string, nth = 0) => wordAt(id, word, nth) - s.from,
    ls: (i = 0) => lineStart(id, i) - s.from,
    le: (i = 0) => lineEnd(id, i) - s.from,
  };
};

export const Bg: React.FC<{ tone: Tone; children?: React.ReactNode; glow?: string }> = ({ tone, children, glow }) => (
  <AbsoluteFill style={{ background: TONE[tone].bg, color: TONE[tone].ink, fontFamily: inter }}>
    {glow ? <AbsoluteFill style={{ background: glow }} /> : null}
    {children}
  </AbsoluteFill>
);

/** Small mono label in caps. */
export const Kicker: React.FC<{ children: React.ReactNode; color?: string; at?: number; style?: React.CSSProperties }> = ({ children, color, at = 0, style }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 12], [0, 1], { ...clamp, easing: expo });
  return <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: "0.14em", textTransform: "uppercase", color, opacity: p, transform: `translateY(${(1 - p) * 10}px)`, ...style }}>{children}</div>;
};

/** Source line under a real number. */
export const Cite: React.FC<{ children: React.ReactNode; at: number; color?: string; style?: React.CSSProperties }> = ({ children, at, color, style }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 14], [0, 1], clamp);
  return <div style={{ fontFamily: mono, fontSize: 16, letterSpacing: "0.02em", color, opacity: p * 0.9, ...style }}>{children}</div>;
};

/** A card that pops in on a spring at `at`. */
export const Card: React.FC<{ at: number; style?: React.CSSProperties; children?: React.ReactNode; dark?: boolean; lime?: boolean }> = ({ at, style, children, dark, lime }) => {
  const f = useCurrentFrame();
  const s = pop(f, at);
  return (
    <div style={{
      borderRadius: 26, padding: "26px 30px",
      background: lime ? C.lime : dark ? C.surface : "#FFFFFF",
      color: lime ? C.ink : dark ? C.text : C.ink,
      border: dark ? `1px solid ${C.border}` : "1px solid rgba(10,11,13,0.08)",
      boxShadow: dark ? "0 30px 70px rgba(0,0,0,0.45)" : "0 24px 60px rgba(10,11,13,0.10)",
      opacity: Math.min(1, s * 1.4), transform: `translateY(${(1 - s) * 40}px) scale(${0.92 + 0.08 * s})`,
      ...style,
    }}>{children}</div>
  );
};

export const Big: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 96, style }) => (
  <div style={{ fontFamily: display, fontWeight: 800, fontSize: size, letterSpacing: "-0.045em", lineHeight: 0.98, ...style }}>{children}</div>
);
