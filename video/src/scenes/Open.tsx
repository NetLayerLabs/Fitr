import React from "react";
import { Img, interpolate, staticFile } from "remotion";
import { C, display, mono } from "../theme";
import { Bg, Cite, Kicker, useScene } from "../ui/kit";
import { Pose, repCurve, drawIn } from "../ui/Pose";
import { Count } from "../ui/Count";
import { clamp, expo } from "../ui/motion";

/** Cold open: the athlete, traced by Fitr's pose lines, and the real gym-attendance numbers. */
export const Open: React.FC = () => {
  const { f, w } = useScene("open");
  const p = repCurve(f, 196, 300, 1, 1);
  const draw = drawIn(f, 8, 70);
  const photoIn = interpolate(f, [0, 30], [0, 1], clamp);
  const S = 760;
  const n17 = interpolate(f, [w("seventeen"), w("seventeen") + 14], [0, 1], { ...clamp, easing: expo });
  return (
    <Bg tone="night" glow={`radial-gradient(50% 60% at 28% 55%, ${C.limeDim}, transparent 70%)`}>
      <div style={{ position: "absolute", left: 120, top: 200, width: S, height: S }}>
        <Img src={staticFile("art/stand-man.jpg")} style={{ position: "absolute", width: S, height: S, opacity: photoIn * (1 - p) * 0.9 }} />
        <Img src={staticFile("art/squat-man.jpg")} style={{ position: "absolute", width: S, height: S, opacity: photoIn * p * 0.9 }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent 60%, ${C.ink})` }} />
        <Pose size={S} draw={draw} p={p} angle={f > 90} strokeScale={0.9} />
      </div>
      <div style={{ position: "absolute", left: 960, top: 250, width: 820 }}>
        <Kicker color={C.lime} at={w("Gym")}>Gym members · monthly plans</Kicker>
        <div style={{ marginTop: 28, display: "flex", alignItems: "baseline", gap: 26 }}>
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 210, letterSpacing: "-0.06em", lineHeight: 0.9, color: C.text, opacity: interpolate(f, [w("four") - 6, w("four") + 4], [0, 1], clamp) }}>
            <Count to={4.3} at={w("four")} dur={30} decimals={1} />
          </span>
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: 52, letterSpacing: "-0.03em", color: C.muted, opacity: interpolate(f, [w("times"), w("times") + 12], [0, 1], clamp) }}>visits<br />a month</span>
        </div>
        <div style={{ marginTop: 40, opacity: n17, transform: `translateY(${(1 - n17) * 24}px)`, display: "flex", alignItems: "baseline", gap: 22 }}>
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 120, letterSpacing: "-0.05em", color: C.lime }}>$17+</span>
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: 40, letterSpacing: "-0.02em", color: C.text }}>a visit, with a $10<br />pass on offer</span>
        </div>
        <Cite at={w("visit.") + 6} color={C.subtle} style={{ marginTop: 34 }}>DellaVigna &amp; Malmendier · American Economic Review · 2006</Cite>
      </div>
      <div style={{ position: "absolute", left: 140, top: 150, fontFamily: mono, fontSize: 15, color: C.lime, letterSpacing: "0.1em", opacity: interpolate(f, [40, 60], [0, 0.85], clamp) }}>POSE · 33 LANDMARKS · ON DEVICE</div>
    </Bg>
  );
};
