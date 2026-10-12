import React from "react";
import { interpolate } from "remotion";
import { C, display, mono } from "../theme";
import { clamp } from "../ui/motion";
import { Bg, Kicker, useScene } from "../ui/kit";
import { Phone } from "../ui/Phone";
import { Chip } from "../ui/Chip";
import { Dial } from "../ui/Dial";
import { pop } from "../ui/motion";

/** Step 3: the day settles at 02:00 UTC and the people who showed up claim. */
export const Claim: React.FC = () => {
  const { f, w } = useScene("claim");
  const settle = pop(f, w("settles.") - 2);
  return (
    <Bg tone="night" glow={`radial-gradient(40% 60% at 76% 50%, ${C.limeDim}, transparent 70%)`}>
      <div style={{ position: "absolute", left: 140, top: 160 }}>
        <Kicker color={C.lime} at={4}>Step 3 · Claim</Kicker>
      </div>
      <div style={{ position: "absolute", left: 80, top: 230 }}>
        <Dial size={520} draw={1} focus="review" settle={settle} hand={2} />
      </div>
      <div style={{ position: "absolute", left: 640, top: 250, width: 520, display: "flex", flexDirection: "column", gap: 16 }}>
        <Chip at={w("stake")} skr title="Your stake back" detail="all of it, when you hit the goal" />
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 46, color: C.lime, marginLeft: 30, opacity: pop(f, w("plus")) }}>+</div>
        <Chip at={w("share")} index="÷" title="A share of forfeits" detail="what no-shows lost, after a 5% fee" />
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 46, color: C.lime, marginLeft: 30, opacity: pop(f, w("forfeited.") + 10) }}>+</div>
        <Chip at={w("forfeited.") + 14} tone="lime" index="★" title="Sponsor bonus" detail="up to 10 SKR a day, live now" />
      </div>
      <div style={{ position: "absolute", left: 640, top: 870, width: 560, fontFamily: mono, fontSize: 17, lineHeight: 1.5, color: C.subtle, opacity: interpolate(f, [w("forfeited.") + 20, w("forfeited.") + 34], [0, 1], clamp) }}>
        <span style={{ color: C.lime }}>THIS CLAIM, ONCHAIN:</span> 5 SKR stake + 10 SKR sponsor bonus = 15 SKR · tx 618CCq…LvD9M
      </div>
      <Phone src={{ device: "claim", fallback: { footage: "today" } }} height={880} left={1260} top={80} tilt={-8} />
    </Bg>
  );
};
