import React from "react";
import { C, mono } from "../theme";

/**
 * Fitr's day as a 24-hour dial (UTC), the film's second motif. Real rules from the vault:
 * commit until 18:00, work out until 24:00, then a grace hour and a one-hour review window,
 * and the day settles at 02:00. `draw` traces the rings in; `hand` is the time in hours;
 * `focus` brightens one part; `ticks` puts a verified mark on the ring.
 */
export type DialPart = "commit" | "workout" | "grace" | "review" | "settle";
const ang = (h: number) => ((h / 24) * 360 - 90) * (Math.PI / 180);
const pt = (r: number, h: number) => [r * Math.cos(ang(h)), r * Math.sin(ang(h))];
const arcPath = (r: number, h1: number, h2: number) => {
  const [x1, y1] = pt(r, h1);
  const [x2, y2] = pt(r, h2);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${h2 - h1 > 12 ? 1 : 0} 1 ${x2} ${y2}`;
};

export const Dial: React.FC<{
  size: number; draw?: number; hand?: number | null; focus?: DialPart | null; labels?: boolean; color?: string;
  ink?: string; muted?: string; verified?: number; settle?: number;
}> = ({ size, draw = 1, hand = null, focus = null, labels = true, color = C.lime, ink = C.text, muted = "rgba(245,246,247,0.45)", verified = 0, settle = 0 }) => {
  const R = 200;
  const dim = (part: DialPart) => (focus && focus !== part ? 0.28 : 1);
  const seg = (r: number, h1: number, h2: number, stroke: string, w: number, part: DialPart, dash?: string) => {
    const end = h1 + (h2 - h1) * Math.max(0, Math.min(1, draw * 1.15 - h1 / 30));
    if (end <= h1 + 0.01) return null;
    return <path d={arcPath(r, h1, end)} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" opacity={dim(part)} strokeDasharray={dash} />;
  };
  return (
    <svg width={size} height={size} viewBox="-260 -260 520 520" style={{ overflow: "visible" }}>
      <circle r={R} fill="none" stroke={muted} strokeOpacity={0.35} strokeWidth={2} />
      {Array.from({ length: 24 }, (_, h) => {
        const [x1, y1] = pt(R + 14, h);
        const [x2, y2] = pt(R + (h % 6 === 0 ? 30 : 22), h);
        return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke={muted} strokeWidth={h % 6 === 0 ? 3 : 1.5} opacity={Math.min(1, draw * 2)} />;
      })}
      {seg(R, 0.05, 18, color, 16, "commit")}
      {seg(R - 30, 0.05, 23.95, color, 6, "workout", "1 12")}
      {seg(R + 52, 0.05, 1, C.amber, 8, "grace")}
      {seg(R + 52, 1.1, 2, ink, 8, "review")}
      {labels && draw > 0.6 ? (
        <g fontFamily={mono} fontSize={17} letterSpacing="1" fill={muted} opacity={Math.min(1, (draw - 0.6) * 3)}>
          {[0, 6, 12, 18].map((h) => {
            const [x, y] = pt(R - 62, h);
            return <text key={h} x={x} y={y + 6} textAnchor="middle" fill={h === 18 ? color : muted}>{String(h).padStart(2, "0")}:00</text>;
          })}
          <text x={pt(R + 84, 1.5)[0] + 16} y={pt(R + 84, 1.5)[1] - 6} fill={ink} opacity={dim("review")}>02:00 settle</text>
        </g>
      ) : null}
      {verified > 0 ? (() => {
        const h = 16.2;
        const [x, y] = pt(R, h);
        return <g transform={`translate(${x} ${y}) scale(${verified})`}><circle r={22} fill={color} /><path d="M -9 0 L -2 7 L 10 -7" stroke={C.ink} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>;
      })() : null}
      {settle > 0 ? (() => {
        const [x, y] = pt(R + 52, 2);
        return <circle cx={x} cy={y} r={14 * settle} fill={color} />;
      })() : null}
      {hand != null ? (() => {
        const [x, y] = pt(R - 10, hand);
        return <g><line x1={0} y1={0} x2={x} y2={y} stroke={ink} strokeWidth={4} strokeLinecap="round" /><circle r={9} fill={ink} /></g>;
      })() : null}
    </svg>
  );
};
