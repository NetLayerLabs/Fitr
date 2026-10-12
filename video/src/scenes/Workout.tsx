import React from "react";
import { scene } from "../timing";
import { C, display } from "../theme";
import { Bg, Kicker, useScene } from "../ui/kit";
import { Phone } from "../ui/Phone";
import { Chip } from "../ui/Chip";
import { Words } from "../ui/Words";

/** The Seeker workout clip runs through workout, check, reps and goal: frames into it for a scene. */
export const workoutOffset = (id: string) => scene(id).from - scene("workout").from;
export const WORKOUT_PHONE = { height: 930, left: 170, top: 60, tilt: 6 } as const;

/** Step 2 begins: the countdown and the first reps, tracked on the phone. */
export const Workout: React.FC = () => {
  const { w } = useScene("workout");
  return (
    <Bg tone="night" glow={`radial-gradient(40% 60% at 22% 50%, ${C.limeDim}, transparent 70%)`}>
      <Phone src={{ device: "workout", fallback: { footage: "setup" } }} {...WORKOUT_PHONE} />
      <div style={{ position: "absolute", left: 820, top: 190, width: 980 }}>
        <Kicker color={C.lime} at={4}>Step 2 · Show up</Kicker>
        <div style={{ marginTop: 26, fontFamily: display, fontWeight: 800, fontSize: 86, letterSpacing: "-0.045em", lineHeight: 1.02, color: C.text }}>
          <Words text="Your video never leaves the phone." at={w("Your")} every={5} accent={{ never: C.lime }} />
        </div>
        <div style={{ marginTop: 50, display: "flex", flexDirection: "column", gap: 16, width: 640 }}>
          <Chip at={w("pose")} index="◉" title="Pose AI on the device" detail="33 body landmarks, every frame" />
          <Chip at={w("device.")} index="↑" title="Only pose points are sent" detail="for the server's replay, never video" />
        </div>
      </div>
    </Bg>
  );
};
