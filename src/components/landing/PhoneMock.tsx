"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { ExerciseArt } from "@/lib/exerciseArt";
import styles from "./PhoneMock.module.css";
import { SkrAmount } from "@/components/brand/SkrAmount";

/**
 * Pose landmarks traced over the push-up photo (420 px square coordinates), drawn the way the
 * live workout HUD draws its skeleton. Purely illustrative.
 */
const JOINTS = {
  head: [372, 250],
  shoulder: [312, 264],
  elbow: [292, 296],
  wrist: [314, 322],
  hip: [208, 270],
  knee: [150, 284],
  ankle: [58, 290],
} as const;

const BONES: Array<[keyof typeof JOINTS, keyof typeof JOINTS]> = [
  ["head", "shoulder"],
  ["shoulder", "elbow"],
  ["elbow", "wrist"],
  ["shoulder", "hip"],
  ["hip", "knee"],
  ["knee", "ankle"],
];

/** The live challenges the app really issues (see lib/attest/challenges). */
const CHALLENGES = ["Raise your right hand", "Raise your left hand", "Hold still at the top"] as const;

const GOAL = 20;
const FROM = 14;
const REP_MS = 1500;
/** Pause on "goal met" before the set starts over. */
const HOLD_MS = 2600;
const CYCLE_MS = (GOAL - FROM) * REP_MS + HOLD_MS;

interface Frame {
  reps: number;
  angle: number;
  cycle: number;
  done: boolean;
}

const STILL: Frame = { reps: 17, angle: 84, cycle: 0, done: false };

/** Where the looping demo set is at `ms` after it started. */
function frameAt(ms: number): Frame {
  const cycle = Math.floor(ms / CYCLE_MS);
  const t = ms % CYCLE_MS;
  const set = (GOAL - FROM) * REP_MS;
  if (t >= set) return { reps: GOAL, angle: 165, cycle, done: true };
  const phase = (t % REP_MS) / REP_MS;
  // Top (165°) -> bottom (84°) -> top; the rep counts as you come back up.
  const angle = Math.round(84 + 81 * (0.5 + 0.5 * Math.cos(2 * Math.PI * phase)));
  return { reps: FROM + Math.floor(t / REP_MS), angle, cycle, done: false };
}

/**
 * The demo set plays only while the phone is on screen and the visitor has not asked for reduced
 * motion; otherwise the still frame (17 of 20) shows.
 */
function useDemoSet(ref: RefObject<HTMLElement | null>): Frame {
  const [frame, setFrame] = useState<Frame>(STILL);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let timer: number | undefined;
    let started = 0;
    let elapsed = 3 * REP_MS; // open on 17 reps, like the still frame
    const stop = () => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
      elapsed += performance.now() - started;
    };
    const start = () => {
      if (timer !== undefined) return;
      started = performance.now();
      timer = window.setInterval(() => setFrame(frameAt(elapsed + performance.now() - started)), 80);
    };
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    io.observe(el);
    return () => {
      io.disconnect();
      stop();
    };
  }, [ref]);
  return frame;
}

/** A stylised Seeker mid-workout: camera view with the pose skeleton, a live rep count and stake. */
export default function PhoneMock({ art, className }: { art: ExerciseArt; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { reps, angle, cycle, done } = useDemoSet(ref);
  const challenge = CHALLENGES[cycle % CHALLENGES.length];
  return (
    <div
      ref={ref}
      data-done={done ? "" : undefined}
      className={className ? `${styles.phone} ${className}` : styles.phone}
      role="img"
      aria-label="Fitr on a phone during a push-up set: 17 of 20 reps counted, a live challenge on screen, 100 SKR staked on today's goal"
    >
      <div className={styles.screen}>
        <div className={styles.status}>
          <span>9:41</span>
          <span className={styles.notch} />
          <span className={styles.battery} />
        </div>
        <div className={styles.top}>
          <span className={styles.live}>
            <span className={styles.liveDot} />
            Live
          </span>
          <span className={styles.exercise}>Push-ups</span>
        </div>
        <div className={styles.camera}>
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static art (see ArtPhoto) */}
          <img src={art.thumb} width={420} height={420} alt="" decoding="async" draggable={false} />
          <span className={styles.scan} aria-hidden="true" />
          <svg viewBox="0 0 420 420" preserveAspectRatio="xMidYMid slice" className={styles.skeleton}>
            {BONES.map(([a, b]) => (
              <line key={`${a}-${b}`} x1={JOINTS[a][0]} y1={JOINTS[a][1]} x2={JOINTS[b][0]} y2={JOINTS[b][1]} />
            ))}
            {Object.entries(JOINTS).map(([name, [x, y]]) => (
              <circle key={name} cx={x} cy={y} r={name === "head" ? 6 : 4.5} data-joint={name} />
            ))}
          </svg>
          <span className={styles.angle}>Elbow {angle}°</span>
          <span className={styles.goalFlash} aria-hidden="true">
            Goal met
          </span>
        </div>
        <div className={styles.counter}>
          <span key={reps} className={styles.reps}>
            {reps}
          </span>
          <span className={styles.goal}>/ {GOAL} reps</span>
        </div>
        <div className={styles.bar}>
          <span style={{ width: `${(reps / GOAL) * 100}%` }} />
        </div>
        <div className={styles.challenge}>
          <span className={styles.challengeTag}>Challenge</span>
          <span key={challenge} className={styles.challengeText}>
            {challenge}
          </span>
        </div>
        <div className={styles.stake}>
          <span>Today&apos;s stake</span>
          <strong><SkrAmount value="100" /></strong>
        </div>
      </div>
    </div>
  );
}
