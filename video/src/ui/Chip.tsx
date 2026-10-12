import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { C, display, mono } from "../theme";
import { pop } from "./motion";

/** A step chip that pops in: an index or icon, a title and an optional detail line. */
export const Chip: React.FC<{ at: number; title: React.ReactNode; detail?: React.ReactNode; index?: string; skr?: boolean; tone?: "dark" | "lime" | "amber" | "red" }> = ({ at, title, detail, index, skr, tone = "dark" }) => {
  const f = useCurrentFrame();
  const s = pop(f, at);
  const bg = tone === "lime" ? C.lime : tone === "amber" ? "rgba(255,176,32,0.14)" : tone === "red" ? "rgba(255,107,120,0.12)" : C.surface;
  const ink = tone === "lime" ? C.ink : C.text;
  const accent = tone === "lime" ? C.ink : tone === "amber" ? C.amber : tone === "red" ? C.red : C.lime;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 22, padding: "20px 26px", borderRadius: 22, background: bg, color: ink,
      border: tone === "dark" ? `1px solid ${C.border}` : `1px solid ${accent}55`,
      opacity: Math.min(1, s * 1.4), transform: `translateX(${(1 - s) * -40}px)`,
    }}>
      {skr ? (
        <Img src={staticFile("brand/skr-token@2x.png")} style={{ width: 46, height: 46 }} />
      ) : index ? (
        <span style={{ width: 46, height: 46, borderRadius: 23, display: "grid", placeItems: "center", background: tone === "lime" ? C.ink : C.limeDim, color: tone === "lime" ? C.lime : accent, fontFamily: mono, fontSize: 18 }}>{index}</span>
      ) : null}
      <div>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 38, letterSpacing: "-0.025em", lineHeight: 1.05 }}>{title}</div>
        {detail ? <div style={{ marginTop: 6, fontFamily: mono, fontSize: 17, color: tone === "lime" ? "rgba(10,11,13,0.65)" : C.subtle, letterSpacing: "0.02em" }}>{detail}</div> : null}
      </div>
    </div>
  );
};
