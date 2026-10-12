import React from "react";
import { interpolate } from "remotion";
import { C, display, mono } from "../theme";
import { Bg, Kicker, useScene } from "../ui/kit";
import { Phone } from "../ui/Phone";
import { Chip } from "../ui/Chip";
import { Count } from "../ui/Count";
import { clamp } from "../ui/motion";
import { WORKOUT_PHONE, workoutOffset } from "./Workout";

/** Goal reached on the Seeker: 15, then 16, Finish & verify, Verified onchain. Stats as the app showed them. */
export const Goal: React.FC = () => {
  const { f, w } = useScene("goal");
  const stats = interpolate(f, [w("verified") + 6, w("verified") + 20], [0, 1], clamp);
  return (
    <Bg tone="night" glow={`radial-gradient(45% 60% at 70% 45%, ${C.limeGlow}, transparent 70%)`}>
      <Phone src={{ device: "workout", fallback: { footage: "setup" } }} offset={workoutOffset("goal")} {...WORKOUT_PHONE} />
      <div style={{ position: "absolute", left: 820, top: 150 }}>
        <Kicker color={C.lime} at={2}>Goal reached</Kicker>
      </div>
      <div style={{ position: "absolute", left: 820, top: 200, display: "flex", alignItems: "baseline", gap: 18 }}>
        <span style={{ fontFamily: display, fontWeight: 900, fontSize: 260, letterSpacing: "-0.07em", lineHeight: 0.9, color: C.lime }}>
          <Count to={16} at={w("Fifteen.") - 20} dur={70} />
        </span>
        <span style={{ fontFamily: display, fontWeight: 800, fontSize: 80, letterSpacing: "-0.04em", color: C.muted }}>/15</span>
      </div>
      <div style={{ position: "absolute", left: 820, top: 480, width: 760, display: "flex", flexDirection: "column", gap: 16 }}>
        <Chip at={w("One")} index="↵" title="Finish & verify onchain" detail="one tap when you're done" />
        <Chip at={w("verified")} tone="lime" index="✓" title="Verified onchain" detail="16 of 15 reps confirmed by the verifier" />
      </div>
      <div style={{ position: "absolute", left: 820, top: 820, fontFamily: mono, fontSize: 18, color: C.subtle, letterSpacing: "0.04em", opacity: stats }}>
        FROM THIS WORKOUT: 1 NOT COUNTED · 2.3 S AVG REP · 95% TRACKING · 1:00 ACTIVE
      </div>
    </Bg>
  );
};
