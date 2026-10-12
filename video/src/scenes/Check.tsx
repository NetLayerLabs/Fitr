import React from "react";
import { interpolate } from "remotion";
import { C, display, mono } from "../theme";
import { Bg, Kicker, useScene } from "../ui/kit";
import { Phone } from "../ui/Phone";
import { Pose } from "../ui/Pose";
import { WORKOUT_PHONE, workoutOffset } from "./Workout";
import { clamp, expo, pop } from "../ui/motion";

/** A random live challenge mid-set: raise a hand within 8 seconds. */
export const Check: React.FC = () => {
  const { f, w } = useScene("check");
  const start = w("live");
  const secs = Math.max(0, 8 - Math.floor(Math.max(0, f - start) / 30));
  const ring = interpolate(f, [start, start + 240], [1, 0], clamp);
  const raise = interpolate(f, [w("raise"), w("raise") + 16], [0, 1], { ...clamp, easing: expo });
  const passed = f > w("hand") + 14;
  const ok = pop(f, w("hand") + 14);
  const R = 70;
  return (
    <Bg tone="night" glow={`radial-gradient(40% 60% at 70% 45%, rgba(255,176,32,0.10), transparent 70%)`}>
      <Phone src={{ device: "workout", fallback: { footage: "setup" } }} offset={workoutOffset("check")} {...WORKOUT_PHONE} />
      <div style={{ position: "absolute", left: 820, top: 150 }}>
        <Kicker color={C.amber} at={start - 6}>Live check · random time</Kicker>
      </div>
      <div style={{ position: "absolute", left: 820, top: 220, width: 980, height: 600, borderRadius: 30, background: "rgba(255,176,32,0.07)", border: `1.5px solid ${passed ? C.lime : C.amber}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 40, top: 40, opacity: interpolate(f, [start, start + 12], [0, 1], clamp) }}>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 84, letterSpacing: "-0.045em", color: C.text, lineHeight: 1 }}>Raise one hand<br />above your head</div>
          <div style={{ marginTop: 24, fontFamily: mono, fontSize: 20, color: C.amber, letterSpacing: "0.06em" }}>WITHIN 8 SECONDS · ANSWERED LIVE</div>
          <svg width={R * 2 + 20} height={R * 2 + 20} style={{ marginTop: 50 }}>
            <circle cx={R + 10} cy={R + 10} r={R} stroke="rgba(255,176,32,0.2)" strokeWidth={10} fill="none" />
            <circle cx={R + 10} cy={R + 10} r={R} stroke={passed ? C.lime : C.amber} strokeWidth={10} fill="none" strokeDasharray={2 * Math.PI * R} strokeDashoffset={2 * Math.PI * R * (1 - (passed ? 1 : ring))} transform={`rotate(-90 ${R + 10} ${R + 10})`} strokeLinecap="round" />
            <text x={R + 10} y={R + 26} textAnchor="middle" fill={passed ? C.lime : C.text} fontFamily={display} fontWeight={800} fontSize={48}>{passed ? "✓" : `${secs}`}</text>
          </svg>
        </div>
        <div style={{ position: "absolute", right: 30, top: 50, width: 480, height: 480 }}>
          <Pose size={480} raise={raise} color={passed ? C.lime : C.amber} />
        </div>
        <div style={{ position: "absolute", left: 40, bottom: 34, display: "flex", alignItems: "center", gap: 14, opacity: ok, transform: `scale(${0.9 + 0.1 * ok})`, transformOrigin: "left center" }}>
          <span style={{ fontFamily: mono, fontSize: 20, color: C.ink, background: C.lime, padding: "8px 16px", borderRadius: 999, letterSpacing: "0.06em" }}>CHECK PASSED</span>
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: 30, color: C.text }}>a recording can't do this on cue</span>
        </div>
      </div>
    </Bg>
  );
};
