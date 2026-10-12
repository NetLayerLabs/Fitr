import React from "react";
import { C, mono } from "../theme";
import { Bg, Kicker, useScene } from "../ui/kit";
import { Phone } from "../ui/Phone";
import { Chip } from "../ui/Chip";
import { Pose, repCurve } from "../ui/Pose";
import { WORKOUT_PHONE, workoutOffset } from "./Workout";

/** The reps (sped up on the phone), next to what the rep engine holds each one to. */
export const Reps: React.FC = () => {
  const { f, w, dur } = useScene("reps");
  const half = f >= w("Half") - 4 && f < w("Half") + 56;
  const p = half ? 0.4 * (0.5 - 0.5 * Math.cos(((f - w("Half") + 4) / 60) * Math.PI * 2)) : repCurve(f, 6, dur, 6);
  return (
    <Bg tone="night" glow={`radial-gradient(40% 60% at 22% 50%, ${C.limeDim}, transparent 70%)`}>
      <Phone src={{ device: "workout", fallback: { footage: "setup" } }} offset={workoutOffset("reps")} {...WORKOUT_PHONE} />
      <div style={{ position: "absolute", left: 820, top: 150 }}>
        <Kicker color={C.lime} at={2}>The rep engine</Kicker>
      </div>
      <div style={{ position: "absolute", left: 820, top: 220, width: 470, height: 600, borderRadius: 30, background: C.surface, border: `1px solid ${half ? C.red : C.border}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 60, width: 470, height: 470 }}>
          <Pose size={470} p={p} angle color={half ? C.red : C.lime} />
        </div>
        <div style={{ position: "absolute", left: 26, top: 22, fontFamily: mono, fontSize: 15, color: C.subtle, letterSpacing: "0.1em" }}>ILLUSTRATION</div>
        <div style={{ position: "absolute", left: 26, bottom: 24, fontFamily: mono, fontSize: 18, letterSpacing: "0.08em", color: half ? C.red : C.lime }}>{half ? "HALF REP · NOT COUNTED" : "FULL DEPTH · COUNTED"}</div>
      </div>
      <div style={{ position: "absolute", left: 1330, top: 220, width: 470, display: "flex", flexDirection: "column", gap: 16 }}>
        <Chip at={w("joint")} index="∠" title="Joint-angle standard" detail="16 exercises, each with its own" />
        <Chip at={w("Half")} tone="red" index="×" title="Half reps don't count" detail="the phone shows them as not counted" />
      </div>
    </Bg>
  );
};
