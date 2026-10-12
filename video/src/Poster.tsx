import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, display, mono, serif } from "./theme";
import { Mark } from "./ui/Mark";
import { Pose } from "./ui/Pose";

/** Thumbnail: the athlete traced by the pose lines, the mark and the promise. */
export const Poster: React.FC = () => (
  <AbsoluteFill style={{ background: C.ink, color: C.text }}>
    <AbsoluteFill style={{ background: `radial-gradient(45% 60% at 30% 55%, ${C.limeDim}, transparent 70%)` }} />
    <div style={{ position: "absolute", left: 80, top: 120, width: 900, height: 900 }}>
      <Img src={staticFile("art/squat-man.jpg")} style={{ width: 900, height: 900, opacity: 0.9 }} />
      <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 120px 80px ${C.ink}` }} />
      <Pose size={900} p={1} angle strokeScale={0.9} />
    </div>
    <div style={{ position: "absolute", left: 960, top: 250 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <Mark size={140} />
        <span style={{ fontFamily: display, fontWeight: 800, fontSize: 180, letterSpacing: "-0.035em" }}>Fitr</span>
      </div>
      <div style={{ marginTop: 30, fontFamily: display, fontWeight: 800, fontSize: 84, letterSpacing: "-0.04em", lineHeight: 1 }}>
        Put your word<br />on the <span style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 400, color: C.lime, fontSize: "1.14em" }}>line.</span>
      </div>
      <div style={{ marginTop: 40, fontFamily: mono, fontSize: 22, color: C.subtle, letterSpacing: "0.08em" }}>AI-VERIFIED REPS · SKR ON SOLANA MAINNET · SEEKER</div>
    </div>
  </AbsoluteFill>
);
