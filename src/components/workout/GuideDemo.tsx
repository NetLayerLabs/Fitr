"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { GuideClip } from "@/lib/formGuide";
import { DEMO_HEIGHT as DEMO_H, DEMO_WIDTH as DEMO_W } from "@/lib/pose/exercises/demo";
import { EXERCISE_MODULES } from "@/lib/pose/exercises/registry";
import type { JudgedAngle } from "@/lib/pose/exercises/types";
import { EXERCISES } from "@/lib/exercises";
import { LM } from "@/lib/pose/landmarks";
import type { ExerciseKind, PoseFrame } from "@/lib/pose/types";
import styles from "./FormGuide.module.css";
import { MANNEQUIN_PALETTE, analyzeRig, buildFigure, drawContactShadow, drawFigure, type Vec, type View } from "./mannequin";

const MAX_DPR = 3;

/** Body points that can rest on the floor, for the contact shadow. */
const CONTACT_POINTS = [
  LM.LEFT_HEEL, LM.RIGHT_HEEL, LM.LEFT_FOOT_INDEX, LM.RIGHT_FOOT_INDEX, LM.LEFT_WRIST, LM.RIGHT_WRIST,
  LM.LEFT_INDEX, LM.RIGHT_INDEX, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_HIP, LM.RIGHT_HIP,
  LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.NOSE,
];

/** Per-exercise constants for the whole loop (normalized image coords unless noted). */
interface Scene {
  view: View;
  /** Body scale as a fraction of the image width. */
  scale: number;
  /** Floor line: below the lowest the feet ever go in the loop, so it never moves. */
  floor: number;
  /** Pull-up bar height (through the grip), or null. */
  bar: number | null;
  /** Wall plane x (behind the back) and which way it extends, or null. */
  wall: { x: number; dir: 1 | -1 } | null;
  /** Bench / chair under the hands (dips): seat top y and its front edge x + backward dir. */
  bench: { y: number; x: number; dir: 1 | -1 } | null;
}

const sceneCache = new Map<ExerciseKind, Scene>();
function sceneFor(kind: ExerciseKind, frames: readonly PoseFrame[]): Scene {
  const cached = sceneCache.get(kind);
  if (cached) return cached;
  const rig = analyzeRig(frames);
  const f0 = frames[0];
  const iw = f0.imageWidth || DEMO_W;
  const ih = f0.imageHeight || DEMO_H;
  const sNorm = rig.scale / iw;
  let floor = 0;
  for (const f of frames) {
    const l = f.landmarks;
    for (const i of [LM.LEFT_HEEL, LM.RIGHT_HEEL, LM.LEFT_FOOT_INDEX, LM.RIGHT_FOOT_INDEX]) {
      if (l[i]) floor = Math.max(floor, l[i].y + (0.04 * rig.scale) / ih);
    }
  }
  const equipment = EXERCISES[kind].equipment;
  let bar: number | null = null;
  if (equipment === "bar") {
    const grips = frames.map((f) => {
      const w = f.landmarks[LM.LEFT_WRIST], i = f.landmarks[LM.LEFT_INDEX];
      return w && i ? (w.y + i.y) / 2 : Infinity;
    });
    bar = Math.min(...grips);
    if (!Number.isFinite(bar)) bar = null;
  }
  let wall: Scene["wall"] = null;
  if (equipment === "wall") {
    const l = f0.landmarks;
    const dir: 1 | -1 = l[LM.NOSE].x >= l[LM.LEFT_EAR].x ? -1 : 1; // the wall is behind the back
    let x = dir < 0 ? Infinity : -Infinity;
    for (const f of frames) {
      for (const i of [LM.LEFT_SHOULDER, LM.LEFT_HIP]) {
        const p = f.landmarks[i];
        if (p) x = dir < 0 ? Math.min(x, p.x) : Math.max(x, p.x);
      }
    }
    wall = { x: x + dir * sNorm * 0.2, dir };
  }
  let bench: Scene["bench"] = null;
  if (equipment === "chair") {
    const l = f0.landmarks;
    const dir: 1 | -1 = l[LM.NOSE].x >= l[LM.LEFT_EAR].x ? -1 : 1; // the seat is behind the body
    let y = 0;
    let x = dir < 0 ? -Infinity : Infinity;
    for (const f of frames) {
      const wr = f.landmarks[LM.LEFT_WRIST];
      if (!wr) continue;
      y = Math.max(y, wr.y);
      x = dir < 0 ? Math.max(x, wr.x) : Math.min(x, wr.x);
    }
    if (Number.isFinite(x)) bench = { y: y + (0.05 * rig.scale) / ih, x: x - dir * sNorm * 0.12, dir };
  }
  const scene: Scene = { view: rig.view, scale: sNorm, floor: Math.min(floor, 0.97), bar, wall, bench };
  sceneCache.set(kind, scene);
  return scene;
}

/** Aspect-corrected angle at the vertex b, in degrees. */
function angleAt(frame: PoseFrame, [a, b, c]: [number, number, number]): number {
  const lms = frame.landmarks;
  const w = frame.imageWidth || DEMO_W;
  const h = frame.imageHeight || DEMO_H;
  const ax = (lms[a].x - lms[b].x) * w, ay = (lms[a].y - lms[b].y) * h;
  const cx = (lms[c].x - lms[b].x) * w, cy = (lms[c].y - lms[b].y) * h;
  const cos = (ax * cx + ay * cy) / (Math.hypot(ax, ay) * Math.hypot(cx, cy) || 1);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

/**
 * Frame shown when motion is reduced: the middle of the longest run of "good" frames (the
 * bottom of a push-up, the top of a bridge), or the middle of the loop when nothing is judged.
 */
function keyFrameIndex(frames: readonly PoseFrame[], judged: JudgedAngle | null): number {
  const middle = Math.floor(frames.length / 2);
  if (!judged) return middle;
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  frames.forEach((f, i) => {
    if (judged.good(angleAt(f, judged.joints))) {
      if (runStart < 0) runStart = i;
      const len = i - runStart + 1;
      if (len > bestLen) {
        bestLen = len;
        bestStart = runStart;
      }
    } else {
      runStart = -1;
    }
  });
  return bestLen > 0 ? bestStart + Math.floor((bestLen - 1) / 2) : middle;
}

function drawFrame(canvas: HTMLCanvasElement, judged: JudgedAngle | null, frame: PoseFrame, scene: Scene) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const css = getComputedStyle(canvas);
  const accent = css.getPropertyValue("--accent").trim() || "#c6f432";
  const text = css.getPropertyValue("--text").trim() || "#fff";
  const muted = css.getPropertyValue("--text-muted").trim() || "#9aa";
  // The app's display face (resolved next/font family list), so labels match the UI type.
  const labelFont = css.getPropertyValue("--font-display").trim() || "system-ui, sans-serif";

  const w = canvas.width;
  const h = canvas.height;
  const unit = w / DEMO_W; // 1 demo px in backing-store px
  const S = scene.scale * w;
  const lms = frame.landmarks;
  const p = (i: number): Vec => (lms[i] ? { x: lms[i].x * w, y: lms[i].y * h } : { x: NaN, y: NaN });

  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  const floorY = scene.floor * h;

  // Props: a wall behind a wall sit, a bar for pull-ups.
  if (scene.wall) {
    const x = scene.wall.x * w;
    const wallGrad = ctx.createLinearGradient(x, 0, x + scene.wall.dir * 40 * unit, 0);
    wallGrad.addColorStop(0, "rgba(255,255,255,0.10)");
    wallGrad.addColorStop(1, "rgba(255,255,255,0.02)");
    ctx.fillStyle = wallGrad;
    const x0 = scene.wall.dir > 0 ? x : 0;
    ctx.fillRect(x0, 0, scene.wall.dir > 0 ? w - x : x, floorY);
    ctx.strokeStyle = muted;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2 * unit;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, floorY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Floor line and the soft contact shadow under whatever rests on it.
  ctx.strokeStyle = muted;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2 * unit;
  ctx.beginPath();
  ctx.moveTo(24 * unit, floorY);
  ctx.lineTo(w - 24 * unit, floorY);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawContactShadow(ctx, CONTACT_POINTS.map(p), floorY, S);

  if (scene.bench) {
    // A plain box seat behind the body, its top under the hands.
    const top = scene.bench.y * h;
    const front = scene.bench.x * w;
    const depth = 0.85 * S;
    const x0 = scene.bench.dir < 0 ? front - depth : front;
    const seat = ctx.createLinearGradient(0, top, 0, floorY);
    seat.addColorStop(0, "rgba(255,255,255,0.16)");
    seat.addColorStop(0.08, "rgba(255,255,255,0.08)");
    seat.addColorStop(1, "rgba(255,255,255,0.03)");
    ctx.fillStyle = seat;
    ctx.beginPath();
    ctx.roundRect(x0, top, depth, floorY - top, [6 * unit, 6 * unit, 0, 0]);
    ctx.fill();
  }

  if (scene.bar !== null) {
    const y = scene.bar * h;
    const r = 0.045 * S;
    const barGrad = ctx.createLinearGradient(0, y - r, 0, y + r);
    barGrad.addColorStop(0, "#c9ced4");
    barGrad.addColorStop(0.45, "#737a83");
    barGrad.addColorStop(1, "#2c3036");
    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect(40 * unit, y - r, w - 80 * unit, 2 * r, r);
    ctx.fill();
  }

  drawFigure(ctx, buildFigure(p, scene.view, S), { ...MANNEQUIN_PALETTE, rim: accent }, unit);

  // Judged joint + its angle.
  if (judged) {
    const deg = angleAt(frame, judged.joints);
    const good = judged.good(deg);
    const joint = p(judged.joints[1]);
    ctx.fillStyle = good ? accent : text;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 3 * unit;
    ctx.beginPath();
    ctx.arc(joint.x, joint.y, 8 * unit, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = `800 ${22 * unit}px ${labelFont}`;
    ctx.textBaseline = "bottom";
    const label = `${judged.label} ${Math.round(deg)}°${good ? " ✓" : ""}`;
    const lx = Math.min(Math.max(joint.x + 14 * unit, 12 * unit), w - ctx.measureText(label).width - 12 * unit);
    const ly = Math.max(joint.y - 16 * unit, 30 * unit);
    ctx.lineWidth = 5 * unit;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeText(label, lx, ly);
    ctx.fillText(label, lx, ly);
  }
  ctx.globalAlpha = 1;
}

function subscribeReducedMotion(listener: () => void): () => void {
  const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  mq?.addEventListener?.("change", listener);
  return () => mq?.removeEventListener?.("change", listener);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    () => false,
  );
}

export interface GuideDemoProps {
  exercise: ExerciseKind;
  /** A verified stock clip; when absent, the animated skeleton demo is shown. */
  clip?: GuideClip;
  label: string;
}

/** The demonstrator: a looping stock clip when we have one, otherwise an animated skeleton. */
export default function GuideDemo({ exercise, clip, label }: GuideDemoProps) {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (clip) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { demo } = EXERCISE_MODULES[exercise];
    const frames = demo.frames();
    if (frames.length === 0) return;
    const scene = sceneFor(exercise, frames);
    const frameMs = 1000 / 30;
    let raf = 0;
    let start = 0;
    // With reduced motion, one still frame (bottom of the rep) is drawn and redrawn on resize.
    const still = reducedMotion ? frames[keyFrameIndex(frames, demo.judged)] : null;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(canvas.clientWidth * dpr) || DEMO_W;
      canvas.height = Math.round(canvas.clientHeight * dpr) || DEMO_H;
      if (still) drawFrame(canvas, demo.judged, still, scene);
    };
    resize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);

    if (still) return () => observer?.disconnect();

    const tick = (now: number) => {
      if (!start) start = now;
      const index = Math.floor(((now - start) % (frames.length * frameMs)) / frameMs);
      drawFrame(canvas, demo.judged, frames[Math.min(index, frames.length - 1)], scene);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [exercise, clip, reducedMotion]);

  if (clip) {
    return (
      <video
        key={clip.src}
        className={styles.demoMedia}
        src={clip.src}
        poster={clip.poster}
        muted
        loop
        playsInline
        autoPlay={!reducedMotion}
        controls={reducedMotion}
        aria-label={label}
      />
    );
  }

  return <canvas ref={canvasRef} className={styles.demoMedia} role="img" aria-label={label} />;
}
