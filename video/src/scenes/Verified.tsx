import React from "react";
import { interpolate } from "remotion";
import { C, display, mono } from "../theme";
import { Bg, Card, Kicker, useScene } from "../ui/kit";
import { Dial } from "../ui/Dial";
import { clamp, expo, pop } from "../ui/motion";

/** The real record: the first verified day, read from Solana mainnet. */
const ROWS: [string, string, string][] = [
  ["Program", "fitr-vault · 9eYqN3…BmgikY", "server"],
  ["Instruction", "attest_completion", "server"],
  ["Day", "20737 · 11 Oct 2026 (UTC)", "day"],
  ["Result", "16 / 15 squats · goal met", "sixteen"],
  ["Signature", "37kSAsEQH9ut…GMhCSTeXU7uw", "Our"],
  ["Compute", "43,775 CU · slot 455,478,918", "Our"],
];
export const Verified: React.FC = () => {
  const { f, w } = useScene("verified");
  const tick = pop(f, w("onchain.") + 4);
  const stamp = interpolate(f, [w("verified"), w("verified") + 10], [0, 1], { ...clamp, easing: expo });
  return (
    <Bg tone="light">
      <div style={{ position: "absolute", left: 120, top: 170 }}>
        <Kicker color="#5E7A00" at={4}>Server replay · pose points, never video</Kicker>
      </div>
      <div style={{ position: "absolute", left: 100, top: 260 }}>
        <Dial size={600} draw={interpolate(f, [0, 40], [0, 1], { ...clamp, easing: expo })} ink={C.ink} muted="rgba(10,11,13,0.45)" color="#7FA300" verified={tick} hand={16.2} focus="workout" />
      </div>
      <Card at={w("records") - 6} style={{ position: "absolute", left: 820, top: 220, width: 980, padding: "34px 44px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: "0.12em", color: "rgba(10,11,13,0.55)" }}>SOLANA MAINNET · ONCHAIN RECORD</div>
          <div style={{ fontFamily: mono, fontSize: 18, color: "#5E7A00" }}>● success</div>
        </div>
        <div style={{ marginTop: 26 }}>
          {ROWS.map(([k, v, word], i) => {
            const at = Math.max(w("records") + i * 5, word === "server" ? 0 : w(word) - 8);
            const p = interpolate(f, [at, at + 12], [0, 1], { ...clamp, easing: expo });
            return (
              <div key={k} style={{ display: "flex", padding: "16px 0", borderTop: "1px solid rgba(10,11,13,0.08)", opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>
                <div style={{ width: 230, fontFamily: mono, fontSize: 20, color: "rgba(10,11,13,0.5)" }}>{k}</div>
                <div style={{ fontFamily: k === "Result" ? display : mono, fontWeight: k === "Result" ? 800 : 500, fontSize: k === "Result" ? 40 : 24, letterSpacing: k === "Result" ? "-0.02em" : 0, color: C.ink }}>{v}</div>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", right: 50, top: 120, fontFamily: display, fontWeight: 900, fontSize: 56, letterSpacing: "0.02em", color: "#5E7A00", border: "5px solid #5E7A00", borderRadius: 14, padding: "4px 20px", transform: `rotate(-7deg) scale(${1.7 - 0.7 * stamp})`, opacity: stamp }}>VERIFIED</div>
      </Card>
    </Bg>
  );
};
