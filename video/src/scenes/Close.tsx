import React from "react";
import { interpolate } from "remotion";
import { C, display, inter, mono } from "../theme";
import { Bg, useScene } from "../ui/kit";
import { Mark } from "../ui/Mark";
import { Words } from "../ui/Words";
import { Dial } from "../ui/Dial";
import { NetLayer } from "../ui/NetLayer";
import { clamp, expo } from "../ui/motion";

/** Close: the mark, the promise, where to get it, who built it. */
export const Close: React.FC = () => {
  const { f, w } = useScene("close");
  const meta = interpolate(f, [w("line.") + 10, w("line.") + 26], [0, 1], { ...clamp, easing: expo });
  return (
    <Bg tone="night" glow={`radial-gradient(45% 55% at 50% 42%, ${C.limeDim}, transparent 72%)`}>
      <div style={{ position: "absolute", left: 960 - 380, top: 420 - 380, opacity: 0.14 }}>
        <Dial size={760} draw={1} labels={false} hand={(f / 270) * 24 + 2} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", justifyContent: "center", alignItems: "center", gap: 34 }}>
        <Mark size={160} at={w("Fitr.") - 6} />
        <span style={{ fontFamily: display, fontWeight: 800, fontSize: 200, letterSpacing: "-0.06em", color: C.text, opacity: interpolate(f, [w("Fitr."), w("Fitr.") + 14], [0, 1], clamp) }}>Fitr</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 500, textAlign: "center", fontFamily: display, fontWeight: 800, fontSize: 80, letterSpacing: "-0.04em", color: C.text }}>
        <Words text="Put your word on the line." at={w("Put")} every={5} accent={{ line: C.lime }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 650, display: "flex", justifyContent: "center", gap: 18, opacity: meta, transform: `translateY(${(1 - meta) * 16}px)` }}>
        <span style={{ fontFamily: inter, fontWeight: 700, fontSize: 30, color: C.ink, background: C.lime, padding: "14px 30px", borderRadius: 999 }}>fitr.day</span>
        <span style={{ fontFamily: inter, fontWeight: 600, fontSize: 30, color: C.text, border: `1px solid ${C.border}`, padding: "14px 30px", borderRadius: 999 }}>Android APK for Seeker</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 800, display: "flex", justifyContent: "center", alignItems: "center", gap: 18, opacity: meta }}>
        <NetLayer height={30} labelColor={C.subtle} />
        <div style={{ width: 1, height: 50, background: C.border, margin: "0 18px" }} />
        <div style={{ fontFamily: mono, fontSize: 17, color: C.subtle, letterSpacing: "0.08em" }}>CLOCK IN · SOLANA MOBILE HACKATHON</div>
      </div>
    </Bg>
  );
};
