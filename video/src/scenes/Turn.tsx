import React from "react";
import { interpolate } from "remotion";
import { C, display } from "../theme";
import { Bg, useScene } from "../ui/kit";
import { Dial } from "../ui/Dial";
import { Mark } from "../ui/Mark";
import { Words } from "../ui/Words";
import { clamp, expo } from "../ui/motion";

/** The turn: the day dial closes into the Fitr mark and the tagline. */
export const Turn: React.FC = () => {
  const { f, w } = useScene("turn");
  const draw = interpolate(f, [0, w("Fitr.")], [0, 1], { ...clamp, easing: expo });
  const fade = interpolate(f, [w("Fitr.") - 4, w("Fitr.") + 14], [1, 0.16], clamp);
  return (
    <Bg tone="night" glow={`radial-gradient(40% 50% at 50% 46%, ${C.limeDim}, transparent 70%)`}>
      <div style={{ position: "absolute", left: 960 - 330, top: 470 - 330, opacity: fade }}>
        <Dial size={660} draw={draw} labels={false} hand={(f / 210) * 24} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 250, display: "flex", justifyContent: "center", alignItems: "center", gap: 36 }}>
        <Mark size={190} at={w("Fitr.") - 4} />
        <span style={{ fontFamily: display, fontWeight: 800, fontSize: 230, letterSpacing: "-0.06em", color: C.text, opacity: interpolate(f, [w("Fitr.") + 2, w("Fitr.") + 16], [0, 1], { ...clamp, easing: expo }) }}>Fitr</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", fontFamily: display, fontWeight: 800, fontSize: 88, letterSpacing: "-0.04em", color: C.text }}>
        <Words text="Put your word on the line." at={w("Put")} every={5} accent={{ line: C.lime }} />
      </div>
    </Bg>
  );
};
