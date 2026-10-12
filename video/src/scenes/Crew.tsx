import React from "react";
import { Img, interpolate, staticFile } from "remotion";
import { C, display, mono } from "../theme";
import { Bg, Kicker, useScene } from "../ui/kit";
import { Chip } from "../ui/Chip";
import { clamp, expo, pop } from "../ui/motion";

/**
 * Crews, with the vault's real rules: a crew's own onchain pool, invite links, no-shows fund the
 * members who showed up (pro rata), and if nobody completes a day its stakes roll over to the
 * crew's next day with a completer. The members are an illustration, not real users.
 */
const CX = 560, CY = 560, R = 270;
const MEMBERS = ["You", "A", "B", "C", "D"];
const at = (i: number) => {
  const a = (-90 + (i * 360) / MEMBERS.length) * (Math.PI / 180);
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
};
const SKIP = 3; // "C" skips in the first case

export const Crew: React.FC = () => {
  const { f, w } = useScene("crew");
  const link = interpolate(f, [w("invite"), w("invite") + 20], [0, 1], { ...clamp, easing: expo });
  const skipT = w("skips");
  const payT = w("pays");
  const nobodyT = w("nobody");
  const rollT = w("rolls");
  const flow = interpolate(f, [payT, payT + 34], [0, 1], { ...clamp, easing: expo });
  const nobody = interpolate(f, [nobodyT, nobodyT + 10], [0, 1], clamp);
  const roll = interpolate(f, [rollT - 4, rollT + 30], [0, 1], { ...clamp, easing: expo });
  const potIn = pop(f, nobodyT + 8);
  const nextDay = pop(f, rollT - 6);
  return (
    <Bg tone="lime">
      <div style={{ position: "absolute", left: 130, top: 120 }}>
        <Kicker color="rgba(10,11,13,0.6)" at={w("crew.") - 4}>Crews · illustration</Kicker>
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(10,11,13,0.18)" strokeWidth={3} strokeDasharray="2 14" strokeLinecap="round" opacity={pop(f, w("crew."))} />
        {MEMBERS.map((_, i) => {
          const [x, y] = at(i);
          return <line key={i} x1={CX} y1={CY} x2={CX + (x - CX) * link} y2={CY + (y - CY) * link} stroke="rgba(10,11,13,0.25)" strokeWidth={2.5} strokeDasharray="6 10" />;
        })}
        {/* The skipper's stake flows out to the members who showed up. */}
        {flow > 0 && flow < 1 && nobody === 0
          ? MEMBERS.map((_, i) => {
              if (i === SKIP) return null;
              const [sx, sy] = at(SKIP);
              const [tx, ty] = at(i);
              const t = flow;
              const x = t < 0.5 ? sx + (CX - sx) * t * 2 : CX + (tx - CX) * (t - 0.5) * 2;
              const y = t < 0.5 ? sy + (CY - sy) * t * 2 : CY + (ty - CY) * (t - 0.5) * 2;
              return <circle key={i} cx={x} cy={y} r={13} fill={C.ink} stroke={C.lime} strokeWidth={3} />;
            })
          : null}
      </svg>
      {MEMBERS.map((name, i) => {
        const [x, y] = at(i);
        const s = pop(f, w("crew.") + i * 4);
        const missed = (i === SKIP && f >= skipT) || nobody > 0;
        const showed = f >= payT + 30 && !missed;
        const stake = pop(f, w("stake") + i * 3);
        return (
          <div key={name} style={{ position: "absolute", left: x - 62, top: y - 62, width: 124, height: 124, borderRadius: 62, background: missed ? "rgba(10,11,13,0.25)" : C.ink, border: `4px solid ${missed ? C.red : C.ink}`, display: "grid", placeItems: "center", opacity: Math.min(1, s * 1.4), transform: `scale(${0.8 + 0.2 * s})` }}>
            <span style={{ fontFamily: display, fontWeight: 800, fontSize: name === "You" ? 34 : 44, color: missed ? C.ink : C.lime }}>{name}</span>
            <div style={{ position: "absolute", right: -16, top: -10, display: "flex", alignItems: "center", gap: 4, padding: "4px 10px 4px 5px", borderRadius: 999, background: C.text, opacity: missed ? 0.35 : stake, transform: `scale(${stake})` }}>
              <Img src={staticFile("brand/skr-token@2x.png")} style={{ width: 24, height: 24 }} />
              <span style={{ fontFamily: mono, fontSize: 18, color: C.ink }}>{showed ? "+" : ""}5</span>
            </div>
            {missed ? <div style={{ position: "absolute", bottom: -38, fontFamily: mono, fontSize: 16, color: C.ink, letterSpacing: "0.08em" }}>MISSED</div> : null}
            {showed && nobody === 0 ? <div style={{ position: "absolute", bottom: -38, fontFamily: mono, fontSize: 16, color: C.ink, letterSpacing: "0.08em" }}>SHOWED UP</div> : null}
          </div>
        );
      })}
      <div style={{ position: "absolute", left: CX - 150, top: CY - 34, width: 300, height: 68, borderRadius: 999, background: C.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: 22, color: C.ink, opacity: link * (1 - potIn), transform: `scale(${0.9 + 0.1 * link})` }}>fitr.day/c/…</div>
      {/* Nobody showed: the pot waits for the crew's next day with a completer. */}
      <div style={{ position: "absolute", left: CX - 70 + roll * 500, top: CY - 70, width: 140, height: 140, borderRadius: 70, background: C.ink, display: "grid", placeItems: "center", opacity: potIn, transform: `scale(${0.7 + 0.3 * potIn})` }}>
        <span style={{ fontFamily: mono, fontSize: 18, color: C.lime, letterSpacing: "0.1em" }}>POT</span>
      </div>
      <div style={{ position: "absolute", left: CX + 640, top: CY - 100, width: 300, padding: "20px 22px", borderRadius: 22, border: `3px dashed ${C.ink}`, opacity: nextDay, transform: `scale(${0.9 + 0.1 * nextDay})` }}>
        <div style={{ fontFamily: mono, fontSize: 15, letterSpacing: "0.1em" }}>ROLLS OVER TO</div>
        <div style={{ marginTop: 6, fontFamily: display, fontWeight: 800, fontSize: 32, letterSpacing: "-0.02em", lineHeight: 1.05 }}>the next day someone shows up</div>
      </div>
      <div style={{ position: "absolute", left: 1220, top: 200, width: 580, display: "flex", flexDirection: "column", gap: 16, opacity: interpolate(f, [rollT - 20, rollT - 4], [1, 0], clamp) }}>
        <Chip at={w("invite")} index="↗" title="An invite link" detail="opens the crew straight in the app" />
        <Chip at={w("onchain")} index="◎" title="Your own onchain pool" detail="a crew streak and a leaderboard" />
        <Chip at={w("pays")} index="→" title="Skippers pay who showed up" detail="pro rata, after the 5% fee" />
      </div>
    </Bg>
  );
};
