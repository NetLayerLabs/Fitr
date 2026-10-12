import React from "react";
import { interpolate } from "remotion";
import { C, display, mono } from "../theme";
import { Bg, useScene } from "../ui/kit";
import { Words } from "../ui/Words";
import { Phone } from "../ui/Phone";
import { clamp, pop } from "../ui/motion";

const LANGS = ["English", "简体中文", "日本語", "한국어", "Italiano", "Español", "Français", "Português", "Deutsch"];

/** Built for Seeker: the Solana Mobile pieces Fitr uses, each a real feature. */
export const Seeker: React.FC = () => {
  const { f, w } = useScene("seeker");
  const tiles: { at: number; k: string; t: string; d: string }[] = [
    { at: w("Genesis"), k: "SEEKER GENESIS TOKEN", t: "One Seeker, one stake", d: "checked onchain, plus a device lock" },
    { at: w("Seed"), k: "SEED VAULT + MWA", t: "Every signature", d: "stakes, claims, sponsorships" },
    { at: w("Seed") + 14, k: "NATIVE ANDROID", t: "Camera, voice coach", d: "reminders, widget, App Links" },
    { at: w("Sponsored"), k: "SPONSORED DAYS", t: "A bonus for finishers", d: "anyone can fund the reserve" },
    { at: w("Blinks,"), k: "BLINKS", t: "Commit with me", d: "Solana Actions, from any post" },
  ];
  const li = Math.floor(Math.max(0, f - w("nine")) / 9) % LANGS.length;
  return (
    <Bg tone="night" glow={`radial-gradient(40% 60% at 80% 50%, ${C.limeDim}, transparent 70%)`}>
      <div style={{ position: "absolute", left: 130, top: 140, fontFamily: display, fontWeight: 800, fontSize: 92, letterSpacing: "-0.045em", color: C.text }}>
        <Words text="Built for Seeker." at={w("Built")} every={6} accent={{ seeker: C.lime }} />
      </div>
      <div style={{ position: "absolute", left: 130, top: 300, width: 1130, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
        {tiles.map((x) => {
          const s = pop(f, x.at - 2);
          return (
            <div key={x.k} style={{ height: 230, borderRadius: 24, padding: "24px 26px", background: C.surface, border: `1px solid ${C.border}`, opacity: Math.min(1, s * 1.4), transform: `translateY(${(1 - s) * 30}px)` }}>
              <div style={{ fontFamily: mono, fontSize: 15, letterSpacing: "0.12em", color: C.lime }}>{x.k}</div>
              <div style={{ marginTop: 18, fontFamily: display, fontWeight: 800, fontSize: 38, letterSpacing: "-0.03em", lineHeight: 1.05, color: C.text }}>{x.t}</div>
              <div style={{ marginTop: 12, fontFamily: mono, fontSize: 16, color: C.subtle }}>{x.d}</div>
            </div>
          );
        })}
        {(() => {
          const s = pop(f, w("nine") - 2);
          return (
            <div style={{ height: 230, borderRadius: 24, padding: "24px 26px", background: C.lime, color: C.ink, opacity: Math.min(1, s * 1.4), transform: `translateY(${(1 - s) * 30}px)` }}>
              <div style={{ fontFamily: mono, fontSize: 15, letterSpacing: "0.12em" }}>9 LANGUAGES</div>
              <div style={{ marginTop: 18, fontFamily: display, fontWeight: 800, fontSize: 52, letterSpacing: "-0.03em" }}>{LANGS[li]}</div>
              <div style={{ marginTop: 10, fontFamily: mono, fontSize: 16, opacity: 0.7 }}>every screen and the voice coach</div>
            </div>
          );
        })()}
      </div>
      <Phone src={{ footage: "workouts" }} height={880} left={1340} top={80} tilt={-8} />
    </Bg>
  );
};
