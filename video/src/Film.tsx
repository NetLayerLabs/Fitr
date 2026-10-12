import React from "react";
import { AbsoluteFill, Audio, Freeze, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { T, scene, wordAt, lineStart } from "./timing";
import { C } from "./theme";
import { Chrome } from "./ui/Chrome";
import { Captions } from "./ui/Captions";
import { Grain } from "./ui/Grain";
import { clamp } from "./ui/motion";
import { Open } from "./scenes/Open";
import { Problem } from "./scenes/Problem";
import { Install } from "./scenes/Install";
import { Turn } from "./scenes/Turn";
import { Commit } from "./scenes/Commit";
import { Workout } from "./scenes/Workout";
import { Check } from "./scenes/Check";
import { Reps } from "./scenes/Reps";
import { Goal } from "./scenes/Goal";
import { Verified } from "./scenes/Verified";
import { Claim } from "./scenes/Claim";
import { Crew } from "./scenes/Crew";
import { Trust } from "./scenes/Trust";
import { Seeker } from "./scenes/Seeker";
import { Next } from "./scenes/Next";
import { Close } from "./scenes/Close";

const SCENES: Record<string, React.FC> = {
  open: Open, problem: Problem, turn: Turn, install: Install, commit: Commit, workout: Workout, check: Check, reps: Reps, goal: Goal,
  verified: Verified, claim: Claim, crew: Crew, trust: Trust, seeker: Seeker, next: Next, close: Close,
};
const OVERLAP = 10; // frames each scene starts early, to cross-dissolve with the last

/** Each scene eases in (a short rise and un-blur) over the tail of the previous one, holding its first frame. */
const SceneIn: React.FC<{ S: React.FC; first: boolean }> = ({ S, first }) => {
  const f = useCurrentFrame();
  if (first) return <S />;
  const p = interpolate(f, [0, OVERLAP], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const body = f < OVERLAP ? <Freeze frame={0}><S /></Freeze> : <Sequence from={OVERLAP} layout="none"><S /></Sequence>;
  return <AbsoluteFill style={{ opacity: p, transform: `scale(${1.03 - 0.03 * p})`, filter: p < 1 ? `blur(${(1 - p) * 10}px)` : undefined }}>{body}</AbsoluteFill>;
};

// Music, ducked under every spoken line; also ducked under the Seeker clips' own sound when present.
const LINES = T.scenes.flatMap((s) => s.lines.map((l) => [l.startFrame, l.words[l.words.length - 1].end] as const));
const DUCK: number[] = (() => {
  const v = new Array<number>(T.totalFrames + 1).fill(0);
  for (let f = 0; f <= T.totalFrames; f++) {
    let d = 0;
    for (const [a, b] of LINES) d = Math.max(d, interpolate(f, [a - 10, a, b, b + 14], [0, 1, 1, 0], clamp));
    v[f] = d;
  }
  return v;
})();
const musicVolume = (f: number) => {
  const end = T.totalFrames;
  const fadeIn = interpolate(f, [0, 24], [0, 1], clamp);
  const fadeOut = interpolate(f, [end - 60, end], [1, 0], clamp);
  return (0.5 - 0.33 * DUCK[Math.min(end, Math.max(0, f))]) * fadeIn * fadeOut;
};

interface Fx { file: string; at: number; vol: number; dur?: number }
function effects(): Fx[] {
  const sc = (id: string) => scene(id).from;
  const w = (id: string, word: string, n = 0) => wordAt(id, word, n);
  const fx: Fx[] = [
    { file: "heartbeat", at: 4, vol: 0.5 }, { file: "heartbeat", at: 60, vol: 0.4 },
    { file: "rep", at: w("open", "four") - 2, vol: 0.35 },
    { file: "stamp", at: w("open", "seventeen") - 2, vol: 0.45 },
    { file: "whoosh", at: sc("problem") - 6, vol: 0.3 },
    ...Array.from({ length: 7 }, (_, i) => ({ file: "tick", at: w("problem", "Skipping") + i * 5, vol: 0.28 })),
    { file: "thud", at: w("problem", "nothing.") - 2, vol: 0.5 },
    { file: "pop", at: w("problem", "half") - 10, vol: 0.4 },
    { file: "pop", at: w("problem", "real") - 10, vol: 0.4 },
    { file: "stamp", at: w("problem", "same") - 1, vol: 0.5 },
    { file: "riser", at: sc("turn") - 90, vol: 0.38 },
    { file: "impact", at: w("turn", "Fitr.") - 4, vol: 0.6 },
    { file: "swoosh_up", at: sc("install") - 6, vol: 0.35 },
    ...["download", "open", "allow"].map((x) => ({ file: "pop", at: w("install", x) - 1, vol: 0.4 })),
    { file: "whoosh", at: sc("commit") - 6, vol: 0.3 },
    ...["Fifteen", "SKR", "Seed", "One"].map((x) => ({ file: "pop", at: w("commit", x) - 1, vol: 0.4 })),
    { file: "lock", at: w("commit", "Vault.") + 4, vol: 0.5 },
    { file: "whoosh", at: sc("workout") - 6, vol: 0.3 },
    ...["pose", "device."].map((x) => ({ file: "click", at: w("workout", x) - 1, vol: 0.4 })),
    { file: "whoosh", at: sc("reps") - 6, vol: 0.25 },
    ...["joint", "Half"].map((x) => ({ file: "click", at: w("reps", x) - 1, vol: 0.4 })),
    { file: "rep", at: w("goal", "Fifteen.") - 2, vol: 0.5 },
    { file: "impact", at: w("goal", "Goal") - 2, vol: 0.35 },
    { file: "chime", at: w("goal", "verified") - 2, vol: 0.45 },
    { file: "tick", at: w("check", "live"), vol: 0.45 }, { file: "tick", at: w("check", "live") + 30, vol: 0.45 }, { file: "tick", at: w("check", "live") + 60, vol: 0.45 },
    { file: "chime", at: w("check", "hand") + 14, vol: 0.45 },
    { file: "swoosh_up", at: sc("verified") - 6, vol: 0.35 },
    { file: "pop", at: w("verified", "records") - 6, vol: 0.4 },
    { file: "stamp", at: w("verified", "verified") - 1, vol: 0.6 },
    { file: "whoosh", at: sc("claim") - 6, vol: 0.3 },
    { file: "chime", at: w("claim", "settles.") - 2, vol: 0.35 },
    { file: "coins", at: w("claim", "stake") - 2, vol: 0.5 },
    { file: "pop", at: w("claim", "share") - 1, vol: 0.4 },
    { file: "swoosh_up", at: sc("crew") - 6, vol: 0.35 },
    ...[0, 1, 2, 3, 4].map((i) => ({ file: "pop", at: w("crew", "crew.") + i * 4, vol: 0.3 })),
    { file: "click", at: w("crew", "invite"), vol: 0.4 },
    { file: "thud", at: w("crew", "skips") - 1, vol: 0.45 },
    { file: "coins", at: w("crew", "pays") - 2, vol: 0.5 },
    { file: "whoosh", at: w("crew", "rolls") - 6, vol: 0.35 },
    { file: "swoosh_up", at: sc("trust") - 6, vol: 0.35 },
    ...[["Squads", 0], ["verifiable,", 0], ["five", 0]].map(([x]) => ({ file: "impact", at: w("trust", x as string) - 4, vol: 0.2 })),
    { file: "whoosh", at: sc("seeker") - 6, vol: 0.3 },
    ...["Genesis", "Seed", "Sponsored", "Blinks,", "nine"].map((x) => ({ file: "pop", at: w("seeker", x) - 3, vol: 0.35 })),
    { file: "swoosh_up", at: sc("next") - 6, vol: 0.35 },
    ...["Fitr", "gym", "dApp"].map((x) => ({ file: "click", at: w("next", x) - 2, vol: 0.4 })),
    { file: "whoosh", at: sc("close") - 6, vol: 0.3 },
    { file: "chime", at: w("close", "Fitr.") - 2, vol: 0.45 },
  ];
  return fx.filter((x) => x.at >= 0 && x.at < T.totalFrames);
}

export const Film: React.FC = () => {
  // Captions sit out where big type already carries the words.
  const hideCaptions = (f: number) => {
    const s = T.scenes.find((x) => f >= x.from && f < x.from + x.durationInFrames);
    if (!s) return true;
    if (["turn", "close", "trust"].includes(s.id)) return true;
    if (s.id === "problem" && f < lineStart("problem", 1)) return true;
    if (s.id === "seeker" && f < wordAt("seeker", "One") - 2) return true;
    return false;
  };
  return (
    <AbsoluteFill style={{ background: C.black }}>
      {T.scenes.map((s, i) => {
        const S = SCENES[s.id];
        const from = i === 0 ? s.from : s.from - OVERLAP;
        const dur = s.durationInFrames + (i === 0 ? 0 : OVERLAP);
        return S ? (
          <Sequence key={s.id} from={from} durationInFrames={dur} name={s.id}>
            <SceneIn S={S} first={i === 0} />
          </Sequence>
        ) : null;
      })}
      <Grain opacity={0.05} />
      <Chrome hideAfter={scene("close").from + 40} />
      <Captions hidden={hideCaptions} />
      <Audio src={staticFile("audio/music.mp3")} volume={musicVolume} />
      {T.scenes.flatMap((s) => s.lines).map((l, i) => (
        <Sequence key={`vo${i}`} from={l.startFrame} durationInFrames={l.durationFrames} name={`vo ${l.text.slice(0, 18)}`}>
          <Audio src={staticFile(l.file)} volume={1} />
        </Sequence>
      ))}
      {effects().map((x, i) => (
        <Sequence key={`fx${i}`} from={x.at} durationInFrames={x.dur ?? 150} name={`fx ${x.file}`}>
          <Audio src={staticFile(`audio/sfx/${x.file}.mp3`)} volume={(f) => x.vol * (x.dur ? interpolate(f, [0, 8, x.dur - 20, x.dur], [0, 1, 1, 0], clamp) : 1)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
