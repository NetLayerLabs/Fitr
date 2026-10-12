import React from "react";
import { C, display, mono } from "../theme";
import { Bg, Kicker, useScene } from "../ui/kit";
import { Phone } from "../ui/Phone";
import { pop } from "../ui/motion";

/** What's next: Fitr Pro in SKR (live in the app as "coming soon"), a gym pilot, the dApp Store. */
export const Next: React.FC = () => {
  const { f, w } = useScene("next");
  const rows = [
    { at: w("Fitr"), k: "FITR PRO · COMING SOON", t: "Paid monthly in SKR", d: "programs, advanced stats, more crews, crew discount" },
    { at: w("gym"), k: "GYM PILOT", t: "30 days with real gyms", d: "attendance and retention, measured" },
    { at: w("dApp"), k: "DISTRIBUTION", t: "Solana dApp Store", d: "and Seeker crew seasons" },
  ];
  return (
    <Bg tone="lime">
      <Phone src={{ footage: "you" }} height={860} left={170} top={100} tilt={8} shadow="0 50px 110px rgba(10,11,13,0.35)" />
      <div style={{ position: "absolute", left: 760, top: 160 }}>
        <Kicker color="rgba(10,11,13,0.6)" at={2}>What's next</Kicker>
      </div>
      <div style={{ position: "absolute", left: 760, top: 230, width: 1020, display: "flex", flexDirection: "column", gap: 22 }}>
        {rows.map((r) => {
          const s = pop(f, r.at - 2);
          return (
            <div key={r.k} style={{ padding: "26px 32px", borderRadius: 26, background: C.ink, color: C.text, opacity: Math.min(1, s * 1.4), transform: `translateX(${(1 - s) * 50}px)` }}>
              <div style={{ fontFamily: mono, fontSize: 16, letterSpacing: "0.12em", color: C.lime }}>{r.k}</div>
              <div style={{ marginTop: 10, fontFamily: display, fontWeight: 800, fontSize: 54, letterSpacing: "-0.035em" }}>{r.t}</div>
              <div style={{ marginTop: 8, fontFamily: mono, fontSize: 18, color: C.subtle }}>{r.d}</div>
            </div>
          );
        })}
      </div>
    </Bg>
  );
};
