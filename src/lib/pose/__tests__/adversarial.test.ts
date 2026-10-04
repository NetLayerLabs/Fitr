/**
 * Adversarial tests for the rep engines: try hard to make them count reps / hold time that
 * did not happen, or to miss reps that did.
 *
 * Tests whose name starts with "fixed:" were written against real defects (knee variants,
 * rotated phones, NaN landmarks, grace-window chaining, slow-device under-credit) and are
 * regression tests now. Every test here must pass.
 */
import { describe, expect, it } from "vitest";
import { LANDMARK_COUNT, LM } from "@/lib/pose/landmarks";
import { toPoseFrame } from "@/lib/pose/runtime/convert";
import { gateFrameByOrientation, nextOrientationStatus, sceneRoll } from "@/lib/pose/runtime/orientation";
import {
  PROPORTIONS,
  keyframes,
  mulberry32,
  plankSequence,
  plankSkeleton,
  pushupSequence,
  pushupSkeleton,
  pushupTimeline,
  renderLandmarks,
  repTimeline,
  squatSequence,
  standingSkeleton,
  withDropout,
  withGap,
  type CameraLayout,
  type RenderOptions,
  type SideSkeleton,
  type Vec,
} from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { eventsOfType, rejectionReasons, runFrames } from "./helpers";

// ---------------------------------------------------------------------------------------
// Inline helpers (capabilities the synthetic generator does not have)
// ---------------------------------------------------------------------------------------

const DEG = Math.PI / 180;
const lerp = (a: Vec, b: Vec, k: number): Vec => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const unit = (v: Vec): Vec => {
  const n = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / n, y: v.y / n };
};

/** Render frames at `fps` from an arbitrary skeleton function (relative time in ms). */
function framesFrom(
  durationMs: number,
  layout: CameraLayout,
  skeletonAt: (tMs: number, rng: () => number) => SideSkeleton,
  options: RenderOptions & { fps?: number; startMs?: number; seed?: number } = {},
): PoseFrame[] {
  const { fps = 30, startMs = 0, seed = 1, width = 640, height = 480 } = options;
  const rng = mulberry32(seed);
  const step = 1000 / fps;
  const out: PoseFrame[] = [];
  for (let i = 0; i * step <= durationMs + 1e-9; i++) {
    const offset = Math.round(i * step);
    out.push({
      timestampMs: startMs + offset,
      landmarks: renderLandmarks(skeletonAt(offset, rng), layout, { ...options, width, height }),
      imageWidth: width,
      imageHeight: height,
    });
  }
  return out;
}

/** Rotate a world-space skeleton by `deg` (counter-clockwise, y up) and translate it. */
function rotateSkeleton(s: SideSkeleton, deg: number, offset: Vec): SideSkeleton {
  const c = Math.cos(deg * DEG);
  const sn = Math.sin(deg * DEG);
  const rot = (v: Vec): Vec => ({ x: v.x * c - v.y * sn, y: v.x * sn + v.y * c });
  const pt = (v: Vec): Vec => {
    const q = rot(v);
    return { x: q.x + offset.x, y: q.y + offset.y };
  };
  return {
    shoulder: pt(s.shoulder),
    elbow: pt(s.elbow),
    wrist: pt(s.wrist),
    hip: pt(s.hip),
    knee: pt(s.knee),
    ankle: pt(s.ankle),
    heel: pt(s.heel),
    footIndex: pt(s.footIndex),
    headDir: rot(s.headDir),
    faceDir: rot(s.faceDir),
    handDir: rot(s.handDir),
  };
}

/** Standing upright, upper arm held straight forward, forearm folding back (a chest press in the air). */
function standingPressSkeleton(elbowDeg: number): SideSkeleton {
  const base = standingSkeleton({ kneeDeg: 178, torsoLeanDeg: 0 });
  const elbow = { x: base.shoulder.x + PROPORTIONS.upperArm, y: base.shoulder.y };
  const e = elbowDeg * DEG;
  const handDir = { x: -Math.cos(e), y: Math.sin(e) };
  const wrist = { x: elbow.x + PROPORTIONS.forearm * handDir.x, y: elbow.y + PROPORTIONS.forearm * handDir.y };
  return { ...base, elbow, wrist, handDir };
}

/**
 * The same standing press seen by a phone lying on its side (camera rolled 90 degrees):
 * the body appears horizontal and "forward" appears as "down".
 */
function rolledCameraStandingPress(elbowDeg: number): SideSkeleton {
  const ref = rotateSkeleton(standingPressSkeleton(170), -90, { x: 0, y: 0 });
  const offset = { x: -ref.shoulder.x, y: 0.03 - ref.wrist.y };
  return rotateSkeleton(standingPressSkeleton(elbowDeg), -90, offset);
}

/**
 * Lying on the back, upper arm pointing at the ceiling, forearm folding towards the head
 * (lying triceps extension), seen by a phone standing upside down (rotated 180 degrees).
 */
function upsideDownSupinePress(elbowDeg: number): SideSkeleton {
  const at = (e: number): SideSkeleton => {
    const shoulder = { x: 0, y: 0.1 };
    const hip = { x: -PROPORTIONS.torso, y: 0.09 };
    const knee = { x: hip.x - PROPORTIONS.thigh, y: 0.08 };
    const ankle = { x: knee.x - PROPORTIONS.shin, y: 0.07 };
    const elbow = { x: 0, y: shoulder.y + PROPORTIONS.upperArm };
    const handDir = { x: Math.sin(e * DEG), y: -Math.cos(e * DEG) };
    const wrist = { x: elbow.x + PROPORTIONS.forearm * handDir.x, y: elbow.y + PROPORTIONS.forearm * handDir.y };
    return {
      shoulder,
      elbow,
      wrist,
      hip,
      knee,
      ankle,
      heel: { x: ankle.x - 0.05, y: 0.02 },
      footIndex: { x: ankle.x + 0.02, y: 0.2 },
      headDir: { x: 1, y: 0 },
      faceDir: { x: 0, y: 1 },
      handDir,
    };
  };
  const ref = rotateSkeleton(at(170), 180, { x: 0, y: 0 });
  const offset = { x: -ref.ankle.x - 0.8, y: 0.03 - ref.wrist.y };
  return rotateSkeleton(at(elbowDeg), 180, offset);
}

/** Standing still, arms held straight out in front (for a rolled-camera "plank"). */
function rolledCameraStandingArmsOut(): SideSkeleton {
  return rolledCameraStandingPress(175);
}

/** Knee push-up: hands under the shoulders, body straight from shoulder to KNEE, shins on the floor. */
function kneePushupSkeleton(elbowDeg: number): SideSkeleton {
  const base = pushupSkeleton({ elbowDeg });
  return withKneesDown(base);
}

/** Forearm plank on the knees (the easy regression), shins on the floor. */
function kneePlankSkeleton(): SideSkeleton {
  return withKneesDown(plankSkeleton({ style: "forearm" }));
}

function withKneesDown(base: SideSkeleton): SideSkeleton {
  const T = PROPORTIONS.torso;
  const G = T + PROPORTIONS.thigh;
  const kneeY = 0.04;
  const dy = base.shoulder.y - kneeY;
  const knee = { x: base.shoulder.x - Math.sqrt(G * G - dy * dy), y: kneeY };
  const hip = lerp(base.shoulder, knee, T / G);
  const ankle = { x: knee.x - PROPORTIONS.shin, y: 0.05 };
  return {
    ...base,
    hip,
    knee,
    ankle,
    heel: { x: ankle.x - 0.02, y: 0.1 },
    footIndex: { x: ankle.x - 0.1, y: 0.02 },
    headDir: unit({ x: base.shoulder.x - hip.x, y: base.shoulder.y - hip.y }),
  };
}

/** Push-up position (arms locked) bending the knees towards the floor. */
function pushupPositionKneeBend(kneeDeg: number): SideSkeleton {
  const base = pushupSkeleton({ elbowDeg: 172 });
  const thighDir = unit({ x: base.hip.x - base.shoulder.x, y: base.hip.y - base.shoulder.y });
  const bend = (180 - kneeDeg) * DEG;
  // Thigh swings down towards the floor by half the knee flexion, shin swings back up.
  const thighAng = Math.atan2(thighDir.y, thighDir.x) + bend / 2;
  const knee = { x: base.hip.x + PROPORTIONS.thigh * Math.cos(thighAng), y: base.hip.y + PROPORTIONS.thigh * Math.sin(thighAng) };
  const shinAng = thighAng - bend;
  const ankle = { x: knee.x + PROPORTIONS.shin * Math.cos(shinAng), y: knee.y + PROPORTIONS.shin * Math.sin(shinAng) };
  return { ...base, knee, ankle, heel: { x: ankle.x - 0.03, y: ankle.y + 0.02 }, footIndex: { x: ankle.x + 0.02, y: ankle.y - 0.05 } };
}

const profile = (points: ReadonlyArray<readonly [number, number]>) => ({
  durationMs: points[points.length - 1][0],
  angleAt: keyframes(points),
});

// ---------------------------------------------------------------------------------------
// Push-ups
// ---------------------------------------------------------------------------------------

describe("adversarial push-ups: honest variations must count exactly", () => {
  it("bouncing at the bottom (several dips around 90 degrees) counts once", () => {
    const frames = pushupSequence({
      profile: profile([
        [0, 170],
        [1000, 170],
        [1500, 80],
        [1700, 110],
        [1900, 78],
        [2100, 120],
        [2300, 82],
        [2500, 100],
        [2700, 75],
        [3300, 170],
        [4200, 170],
      ]),
    });
    for (const [label, f] of [
      ["clean", frames],
      ["jitter", pushupSequence({ jitterDeg: 4, seed: 4, profile: profile([[0, 170], [1000, 170], [1500, 80], [1700, 110], [1900, 78], [2100, 120], [2300, 82], [2700, 75], [3300, 170], [4200, 170]]) })],
    ] as const) {
      const result = runFrames("pushup", f);
      expect(result.final.reps, label).toBe(1);
      expect(result.final.rejectedReps, label).toBe(0);
    }
  });

  it("hovering at the lockout threshold (155 +/- 6 degrees) for 10 s counts nothing", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const frames = pushupSequence({ jitterDeg: 6, seed, profile: profile([[0, 155], [10_000, 155]]) });
      const result = runFrames("pushup", frames);
      expect(result.final.reps).toBe(0);
      expect(result.final.rejectedReps).toBe(0);
    }
  });

  it("very slow reps (4 s and 6 s, with a 2 s pause at the bottom) all count", () => {
    for (const repMs of [4000, 6000]) {
      for (const fps of [15, 30]) {
        const result = runFrames("pushup", pushupSequence({ reps: 4, repMs, bottomHoldMs: 2000, fps, jitterDeg: 3, seed: repMs }));
        expect(result.final.reps, `${repMs} ms @ ${fps} fps`).toBe(4);
        expect(result.final.rejectedReps).toBe(0);
      }
    }
  });

  it("half rep then full rep: one go_lower rejection, one counted rep", () => {
    const result = runFrames("pushup", pushupSequence({ reps: [{ bottomAngle: 115 }, {}] }));
    expect(rejectionReasons(result)).toEqual(["go_lower"]);
    expect(result.final.reps).toBe(1);
  });

  it("half-way down, pause (not locked out), then all the way down and up counts once", () => {
    const result = runFrames(
      "pushup",
      pushupSequence({ profile: profile([[0, 170], [1000, 170], [1400, 120], [1800, 148], [2300, 72], [2900, 170], [3700, 170]]) }),
    );
    expect(result.final.reps).toBe(1);
    expect(result.final.rejectedReps).toBe(0);
  });

  it.each([
    ["60 fps", { fps: 60 }],
    ["60 fps with jitter", { fps: 60, jitterDeg: 4, seed: 3 }],
    ["15 fps, fast 800 ms reps to 80 degrees", { fps: 15, repMs: 800, bottomAngle: 80, holdMs: 200 }],
    ["24 fps with jitter", { fps: 24, jitterDeg: 4, seed: 5 }],
    ["portrait 720x1280", { width: 720, height: 1280 }],
    ["portrait 720x1280 at 15 fps with jitter", { width: 720, height: 1280, fps: 15, jitterDeg: 4, seed: 6 }],
  ])("counts exactly 5 reps (%s)", (_label, options) => {
    const result = runFrames("pushup", pushupSequence({ reps: 5, ...options }));
    expect(result.final.reps).toBe(5);
    expect(result.final.rejectedReps).toBe(0);
  });

  it("side switching mid-set (left visibility fades, right rises, crossing at the bottom of a rep)", () => {
    const timeline = pushupTimeline({ reps: 5 });
    const mid = timeline.reps[2].bottomStartMs;
    const base = pushupSequence({ reps: 5 });
    const left: number[] = [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE];
    const right: number[] = [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE];
    const frames = base.map((f) => {
      const k = Math.min(1, Math.max(0, (f.timestampMs - (mid - 600)) / 1200));
      return {
        ...f,
        landmarks: f.landmarks.map((lm, i) =>
          left.includes(i) ? { ...lm, visibility: 0.98 - 0.7 * k } : right.includes(i) ? { ...lm, visibility: 0.6 + 0.38 * k } : lm,
        ),
      };
    });
    const result = runFrames("pushup", frames);
    expect(result.final.side).toBe("right");
    expect(result.final.reps).toBe(5);
    expect(result.final.rejectedReps).toBe(0);
  });

  it("walking out of frame at the bottom and back in at the bottom never completes that rep", () => {
    // Rep 1 counts; at the bottom of rep 2 the user leaves for 2 s and comes back at the bottom,
    // then presses up: that press is only a start position, rep 3 counts.
    const frames = withDropout(
      pushupSequence({
        profile: profile([[0, 170], [1000, 170], [1600, 70], [2200, 170], [2500, 170], [3000, 70], [5500, 70], [6100, 170], [6500, 170], [7100, 70], [7700, 170], [8500, 170]]),
      }),
      3100,
      5100,
    );
    const result = runFrames("pushup", frames);
    expect(result.final.reps).toBe(2);
    expect(result.final.rejectedReps).toBe(0);
  });

  it("a 32-landmark frame burst mid-rep is treated as lost tracking, not as a pose", () => {
    const timeline = pushupTimeline({ reps: 5 });
    const bottom = timeline.reps[2].bottomStartMs;
    const frames = pushupSequence({ reps: 5 }).map((f) =>
      f.timestampMs >= bottom - 200 && f.timestampMs < bottom + 400 ? { ...f, landmarks: f.landmarks.slice(0, LANDMARK_COUNT - 1) } : f,
    );
    const result = runFrames("pushup", frames);
    expect(result.final.reps).toBe(4);
  });
});

describe("adversarial push-ups: cheats that must count nothing", () => {
  it("lying still with elbows at 90 degrees (+/-5 jitter) for 10 s: no reps, no rejections", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const result = runFrames("pushup", pushupSequence({ jitterDeg: 5, seed, profile: profile([[0, 90], [10_000, 90]]) }));
      expect(result.final.reps).toBe(0);
      expect(result.final.rejectedReps).toBe(0);
    }
  });

  it("holding the bottom at 90 +/- 5 after one real rep does not add reps", () => {
    const frames = pushupSequence({
      jitterDeg: 5,
      seed: 2,
      profile: profile([[0, 170], [1000, 170], [1600, 70], [2200, 170], [2600, 170], [3200, 90], [12_000, 90]]),
    });
    const result = runFrames("pushup", frames);
    expect(result.final.reps).toBe(1);
  });

  it("duplicate / backwards timestamps carrying a bottom pose cannot mint a rep", () => {
    const top = pushupSequence({ profile: profile([[0, 170], [6000, 170]]) });
    const bottomPose = pushupSequence({ profile: profile([[0, 60], [100, 60]]) })[0].landmarks;
    const frames: PoseFrame[] = [];
    for (const f of top) {
      frames.push(f);
      frames.push({ ...f, landmarks: bottomPose }); // same timestamp
      frames.push({ ...f, timestampMs: f.timestampMs - 5, landmarks: bottomPose }); // backwards
    }
    const result = runFrames("pushup", frames);
    expect(result.final.reps).toBe(0);
    expect(result.final.rejectedReps).toBe(0);
  });

  it("NaN coordinates on the tracked elbow are treated as not visible by the engine", () => {
    const timeline = pushupTimeline({ reps: [{}, { holdMs: 1500 }, {}, {}, {}] });
    const at = timeline.reps[1].endMs + 50;
    const frames = pushupSequence({ reps: [{}, { holdMs: 1500 }, {}, {}, {}] }).map((f) =>
      f.timestampMs >= at && f.timestampMs < at + 900
        ? { ...f, landmarks: f.landmarks.map((lm, i) => (i === LM.LEFT_ELBOW ? { ...lm, x: Number.NaN, y: Number.NaN } : lm)) }
        : f,
    );
    const result = runFrames("pushup", frames);
    expect(result.final.reps).toBe(5);
    expect(result.final.rejectedReps).toBe(0);
  });

  it("worm / cobra push-ups (hips stay on the floor, only the chest lifts) are rejected", () => {
    const cobra = (elbowDeg: number): SideSkeleton => {
      const base = pushupSkeleton({ elbowDeg });
      const hipY = 0.08;
      const dy = Math.min(base.shoulder.y - hipY, PROPORTIONS.torso * 0.999);
      const hip = { x: base.shoulder.x - Math.sqrt(PROPORTIONS.torso ** 2 - dy * dy), y: hipY };
      const knee = { x: hip.x - PROPORTIONS.thigh, y: 0.07 };
      const ankle = { x: knee.x - PROPORTIONS.shin, y: 0.06 };
      return { ...base, hip, knee, ankle, heel: { x: ankle.x - 0.05, y: 0.08 }, footIndex: { x: ankle.x + 0.02, y: 0 } };
    };
    const timeline = repTimeline({ reps: 5, topAngle: 170, bottomAngle: 65, repMs: 1200 });
    const result = runFrames("pushup", framesFrom(timeline.durationMs, "floor", (t) => cobra(timeline.angleAt(t))));
    expect(result.final.reps).toBe(0);
  });

  it("fixed: knee push-ups (body straight only from shoulder to knee) do not count as push-ups", () => {
    const timeline = pushupTimeline({ reps: 5 });
    const frames = framesFrom(timeline.durationMs, "floor", (t) => kneePushupSkeleton(timeline.angleAt(t)));
    const result = runFrames("pushup", frames);
    // A knee push-up is the easy regression; a proof-of-workout counter must not pay it out as a push-up.
    expect(result.final.reps).toBe(0);
  });

  it("fixed: phone lying on its side (camera rolled 90 deg): standing chest presses in the air do not count", () => {
    const timeline = pushupTimeline({ reps: 5 });
    const frames = framesFrom(timeline.durationMs, "floor", (t) => rolledCameraStandingPress(timeline.angleAt(t)));
    const result = runFrames("pushup", frames);
    expect(result.final.reps).toBe(0);
  });

  it("fixed: phone upside down: lying on your back doing triceps extensions does not count", () => {
    const timeline = pushupTimeline({ reps: 5 });
    const frames = framesFrom(timeline.durationMs, "floor", (t) => upsideDownSupinePress(timeline.angleAt(t)));
    const result = runFrames("pushup", frames);
    expect(result.final.reps).toBe(0);
  });

  it("the planted-hands guard is what stops rotated-phone air presses (orientation-independent)", () => {
    // Both cheats pass every image-axis posture gate; only the hands moving instead of the
    // body gives them away. Disabling that guard lets them count.
    const timeline = pushupTimeline({ reps: 5 });
    for (const cheat of [rolledCameraStandingPress, upsideDownSupinePress]) {
      const frames = framesFrom(timeline.durationMs, "floor", (t) => cheat(timeline.angleAt(t)));
      expect(runFrames("pushup", frames).final.reps).toBe(0);
      expect(runFrames("pushup", frames, { maxWristDriftRatio: 100 }).final.reps).toBe(5);
    }
  });

  it("fixed: MediaPipe NaN elbow coordinates (visibility intact) do not become a visible joint at the image corner", () => {
    // Real push-ups at the top (locked out, never bending); for 700 ms the model returns NaN x/y
    // for the near elbow with its usual visibility. The runtime converter is part of the pipeline.
    const frames = pushupSequence({ profile: profile([[0, 170], [6000, 170]]) }).map((f) => {
      const raw = f.landmarks.map((lm, i) =>
        i === LM.LEFT_ELBOW && f.timestampMs >= 2000 && f.timestampMs < 2700 ? { ...lm, x: Number.NaN, y: Number.NaN } : lm,
      );
      return toPoseFrame({ landmarks: [raw] }, f.timestampMs, f.imageWidth, f.imageHeight);
    });
    const converted = frames.find((f) => f.timestampMs === 2000)!.landmarks[LM.LEFT_ELBOW];
    const result = runFrames("pushup", frames);
    expect(result.final.reps).toBe(0);
    expect(converted.visibility).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------
// Squats
// ---------------------------------------------------------------------------------------

describe("adversarial squats", () => {
  it("bouncing at the bottom counts once", () => {
    const result = runFrames(
      "squat",
      squatSequence({
        jitterDeg: 3,
        seed: 3,
        profile: profile([[0, 175], [1000, 175], [1800, 75], [2000, 110], [2200, 72], [2400, 115], [2600, 78], [3400, 175], [4200, 175]]),
      }),
    );
    expect(result.final.reps).toBe(1);
    expect(result.final.rejectedReps).toBe(0);
  });

  it.each([
    ["60 fps", { fps: 60 }],
    ["60 fps with jitter", { fps: 60, jitterDeg: 4, seed: 9 }],
    ["portrait 720x1280 at 15 fps", { width: 720, height: 1280, fps: 15 }],
    ["very slow 5 s reps with a 2 s pause at the bottom", { repMs: 5000, bottomHoldMs: 2000 }],
    ["15 fps, 1.2 s reps to 88 degrees", { fps: 15, repMs: 1200, bottomAngle: 88, holdMs: 300 }],
  ])("counts exactly 5 reps (%s)", (_label, options) => {
    const result = runFrames("squat", squatSequence({ reps: 5, ...options }));
    expect(result.final.reps).toBe(5);
    expect(result.final.rejectedReps).toBe(0);
  });

  it("knee bends in the push-up position never start a squat set", () => {
    const timeline = repTimeline({ reps: 5, topAngle: 175, bottomAngle: 70, repMs: 1600, holdMs: 400 });
    const frames = framesFrom(timeline.durationMs, "floor", (t) => pushupPositionKneeBend(timeline.angleAt(t)));
    const result = runFrames("squat", frames);
    expect(result.final.reps).toBe(0);
    expect(result.final.rejectedReps).toBe(0);
    expect(result.phases).toEqual(["searching"]);
  });

  it("standing still with knee jitter around 160 counts nothing", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const result = runFrames("squat", squatSequence({ jitterDeg: 6, seed, profile: profile([[0, 160], [10_000, 160]]) }));
      expect(result.final.reps).toBe(0);
      expect(result.final.rejectedReps).toBe(0);
    }
  });

  it("sitting down on a chair and standing up counts as a (box) squat (documented behaviour)", () => {
    // Seated: knee ~88 degrees, torso upright (10 degrees), hip at knee height, 2 s rest on the chair.
    const timeline = repTimeline({ reps: 4, topAngle: 176, bottomAngle: 88, repMs: 2000, bottomHoldMs: 2000, holdMs: 500 });
    const frames = framesFrom(timeline.durationMs, "standing", (t) => {
      const k = timeline.angleAt(t);
      // Lean forward while moving, upright when seated / standing.
      const lean = 10 + 25 * Math.sin(Math.PI * Math.min(1, (176 - k) / 88));
      return standingSkeleton({ kneeDeg: k, torsoLeanDeg: lean });
    });
    const result = runFrames("squat", frames);
    expect(result.final.reps).toBe(4);
  });

  it("walking out of frame at the bottom and back standing does not count that rep", () => {
    const frames = squatSequence({
      profile: profile([[0, 175], [1000, 175], [1800, 70], [2600, 175], [3000, 175], [3800, 70], [5800, 175], [6400, 175], [7200, 70], [8000, 175], [8800, 175]]),
    });
    const result = runFrames("squat", withDropout(frames, 3900, 5700));
    expect(result.final.reps).toBe(2);
    expect(result.final.rejectedReps).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------
// Plank
// ---------------------------------------------------------------------------------------

describe("adversarial plank", () => {
  it("slowly increasing sag stops the timer about when the body line drops below 160", () => {
    // Hip bend 0 -> 35 over 20 s; body line = 180 - bend crosses 160 at 11.43 s.
    const frames = plankSequence({ durationMs: 20_000, hipBendDeg: (t) => (35 * t) / 20_000 });
    const result = runFrames("plank", frames);
    const pauses = eventsOfType(result, "hold_pause");
    expect(pauses.map((e) => e.reason)).toEqual(["hips_sagging"]);
    expect(result.final.holdMs).toBeGreaterThan(10_800);
    expect(result.final.holdMs).toBeLessThan(12_200);
    expect(result.final.phase).toBe("paused");
  });

  it("slowly increasing sag with jitter: nothing credited well past the threshold", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const frames = plankSequence({ durationMs: 20_000, jitterDeg: 4, seed, hipBendDeg: (t) => (35 * t) / 20_000 });
      const result = runFrames("plank", frames);
      // Bend reaches 24 deg (body line 156) at 13.7 s; nothing after ~14 s should be credited.
      expect(result.final.holdMs, `seed ${seed}`).toBeLessThan(14_000);
    }
  });

  it("1 fps stalled camera: at most 200 ms credited per frame", () => {
    const frames = plankSequence({ durationMs: 30_000, fps: 1 });
    const result = runFrames("plank", frames);
    expect(result.final.holdMs).toBeLessThanOrEqual(200 * frames.length);
    expect(result.final.holdMs).toBeGreaterThan(0);
  });

  it("stalled frames injected into a 30 fps stream cannot add more than 200 ms each", () => {
    const frames = withGap(plankSequence({ durationMs: 12_000 }), 2000, 10_000);
    const result = runFrames("plank", frames);
    expect(result.final.holdMs).toBeLessThanOrEqual(2000 + 2000 + 200 + 34);
  });

  it("timestamps going backwards / duplicated cannot add hold time", () => {
    const frames = plankSequence({ durationMs: 5000 });
    const doubled: PoseFrame[] = [];
    for (const f of frames) doubled.push(f, { ...f }, { ...f, timestampMs: f.timestampMs - 20 });
    const result = runFrames("plank", doubled);
    expect(Math.abs(result.final.holdMs - 5000)).toBeLessThanOrEqual(34);
  });

  it("knee bends / squats while standing are not a plank", () => {
    const result = runFrames("plank", squatSequence({ reps: 4 }));
    expect(result.final.holdMs).toBe(0);
  });

  it("fixed: hip-bobbing plank (hips sagging 450 ms of every 600 ms, straight in 150 ms blips) is not credited as a full hold", () => {
    // Every 600 ms: 450 ms with hips sagging 30 deg (body line 150, clearly invalid), 150 ms straight.
    const frames = plankSequence({ durationMs: 20_000, hipBendDeg: (t) => (t % 600 < 450 ? 30 : 0) });
    const result = runFrames("plank", frames);
    // At most the valid quarter (+ generous slack) may be credited.
    expect(result.final.holdMs).toBeLessThan(0.5 * 20_000);
  });

  it("fixed: knee plank (forearms, knees and shins on the floor) is not credited as a plank", () => {
    const frames = framesFrom(10_000, "floor", () => kneePlankSkeleton());
    const result = runFrames("plank", frames);
    expect(result.final.holdMs).toBe(0);
  });

  it("fixed: phone lying on its side: standing with arms held out is not credited as a plank (runtime gate)", () => {
    // A still, rotated standing pose with the arms held out is essentially image-identical to a
    // straight-arm plank, so no image-only check can reject it: the engine alone credits it
    // (next test). Gravity from the device is what tells them apart. This test drives the
    // frames through the runtime's orientation gate with the reading such a phone produces
    // (lying on its side: beta 0, gamma 90, portrait-locked screen), as WorkoutScreen does.
    let status = nextOrientationStatus("unknown", null);
    const frames = framesFrom(10_000, "floor", () => rolledCameraStandingArmsOut()).map((f) => {
      status = nextOrientationStatus(status, sceneRoll(0, 90, 0));
      return gateFrameByOrientation(f, status);
    });
    expect(status).toBe("tilted");
    const result = runFrames("plank", frames);
    expect(result.final.holdMs).toBe(0);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
  });

  it("documented limit: the engine alone cannot tell a sideways phone from a plank", () => {
    // Without the runtime gate above, the rotated standing pose is credited. If this ever starts
    // failing because the engine learned about gravity, flip it into a regression test.
    const frames = framesFrom(10_000, "floor", () => rolledCameraStandingArmsOut());
    expect(runFrames("plank", frames).final.holdMs).toBeGreaterThan(9900);
    // An upright phone passes frames through untouched.
    const upright = nextOrientationStatus("unknown", sceneRoll(85, 2, 0));
    expect(upright).toBe("upright");
    expect(gateFrameByOrientation(frames[0], upright)).toBe(frames[0]);
  });

  it("fixed: plank at 4 fps (slow device) credits an honest hold in full", () => {
    const frames = plankSequence({ durationMs: 20_000, fps: 4 });
    const result = runFrames("plank", frames);
    // Frames 250 ms apart are continuous tracking (< maxFrameGapMs = 500) yet each is capped at 200 ms.
    expect(result.final.holdMs).toBeGreaterThan(0.95 * 20_000 - 250);
  });
});
