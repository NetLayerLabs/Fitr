import React from "react";
import { C } from "../theme";
import { Bg, Kicker, useScene } from "../ui/kit";
import { Phone } from "../ui/Phone";
import { Chip } from "../ui/Chip";
import { interpolate } from "remotion";
import { mono } from "../theme";
import { clamp } from "../ui/motion";

/** Step 1 on the Seeker: pick the goal, stake SKR, sign in Seed Vault. */
export const Commit: React.FC = () => {
  const { f, w } = useScene("commit");
  return (
    <Bg tone="night" glow={`radial-gradient(40% 60% at 75% 50%, ${C.limeDim}, transparent 70%)`}>
      <div style={{ position: "absolute", left: 140, top: 190, width: 760 }}>
        <Kicker color={C.lime} at={4}>Step 1 · Commit</Kicker>
        <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 18 }}>
          <Chip at={w("Fifteen")} index="01" title="15 squats" detail="today's goal, on the record" />
          <Chip at={w("SKR")} skr title="5 SKR staked" detail="your own stake, 1 to 10,000 SKR" />
          <Chip at={w("Seed")} index="02" title="Signed in Seed Vault" detail="the phone's secure hardware" />
          <Chip at={w("One")} tone="lime" index="03" title="1 transaction · Solana mainnet" detail="locked in the vault until the day settles" />
        </div>
      </div>
      <div style={{ position: "absolute", left: 140, top: 820, fontFamily: mono, fontSize: 18, color: C.subtle, letterSpacing: "0.06em", opacity: interpolate(f, [w("One"), w("One") + 14], [0, 1], clamp) }}>
        COMMITS CLOSE AT 18:00 UTC · LATER STAKES COUNT FOR TOMORROW
      </div>
      <Phone src={{ device: "commit", fallback: { footage: "commit" } }} height={880} left={1180} top={80} enter={0} tilt={-8} />
    </Bg>
  );
};
