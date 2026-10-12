import React from "react";
import { interpolate } from "remotion";
import { C, display, mono } from "../theme";
import { Bg, Card, useScene } from "../ui/kit";
import { Words } from "../ui/Words";
import { Pose } from "../ui/Pose";
import { clamp, expo, pop } from "../ui/motion";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** No consequence: skipping is free, and nobody checks a half rep. */
export const Problem: React.FC = () => {
  const { f, w, ls } = useScene("problem");
  const second = ls(1);
  const outA = interpolate(f, [second - 16, second], [1, 0], clamp);
  const deep = "#5E7A00";
  return (
    <Bg tone="light">
      <div style={{ position: "absolute", left: 140, top: 210, width: 1640, opacity: outA }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 104, letterSpacing: "-0.045em", lineHeight: 1.02 }}>
          <Words text="We don't lack plans." at={w("We")} every={6} /><br />
          <Words text="We lack consequences." at={w("We", 1)} every={6} accent={{ consequences: deep }} />
        </div>
        <div style={{ marginTop: 80, display: "flex", gap: 18, alignItems: "center" }}>
          {DAYS.map((d, i) => {
            const at = w("Skipping") + i * 5;
            const s = pop(f, at);
            const x = interpolate(f, [w("nothing.") - 10 + i * 3, w("nothing.") + i * 3], [0, 1], clamp);
            return (
              <div key={d} style={{ width: 150, height: 120, borderRadius: 20, background: "#FFFFFF", border: "1px solid rgba(10,11,13,0.1)", opacity: s, transform: `scale(${0.9 + 0.1 * s})`, position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "14px 18px" }}>
                <span style={{ fontFamily: mono, fontSize: 16, color: "rgba(10,11,13,0.5)" }}>{d.toUpperCase()}</span>
                <span style={{ fontFamily: display, fontWeight: 700, fontSize: 26, color: "rgba(10,11,13,0.35)", opacity: x }}>skipped</span>
              </div>
            );
          })}
          <div style={{ marginLeft: 30, fontFamily: display, fontWeight: 800, fontSize: 64, letterSpacing: "-0.03em", opacity: interpolate(f, [w("costs"), w("costs") + 10], [0, 1], clamp) }}>
            Cost: <span style={{ color: C.red }}>0</span>
          </div>
        </div>
      </div>
      {f >= second - 6 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", justifyContent: "center", gap: 70 }}>
          {[
            { at: w("half"), p: 0.38, title: "Half rep", note: "counted anyway", color: C.red },
            { at: w("real"), p: 1, title: "Real rep", note: "full depth", color: C.lime },
          ].map((x) => {
            const stamp = interpolate(f, [w("same"), w("same") + 10], [0, 1], { ...clamp, easing: expo });
            const isHalf = x.title === "Half rep";
            return (
              <Card key={x.title} at={x.at - 10} dark style={{ width: 600, height: 700, padding: 0, overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", left: 30, top: 26, fontFamily: mono, fontSize: 18, letterSpacing: "0.12em", color: x.color }}>{x.title.toUpperCase()}</div>
                <div style={{ position: "absolute", left: 40, top: 70, width: 520, height: 520 }}>
                  <Pose size={520} p={x.p * interpolate(f, [x.at - 4, x.at + 18], [0, 1], { ...clamp, easing: expo })} angle color={x.color} />
                </div>
                <div style={{ position: "absolute", left: 30, bottom: 30, fontFamily: display, fontWeight: 700, fontSize: 34, color: C.text }}>{x.note}</div>
                {isHalf ? (
                  <div style={{ position: "absolute", right: 30, bottom: 26, fontFamily: mono, fontSize: 20, color: C.red, border: `3px solid ${C.red}`, borderRadius: 10, padding: "6px 14px", transform: `rotate(-8deg) scale(${1.6 - 0.6 * stamp})`, opacity: stamp }}>+1 REP?</div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}
    </Bg>
  );
};
