import type { ExerciseArt } from "@/lib/exerciseArt";
import styles from "./PhoneMock.module.css";

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

/** A stylised Seeker mid-workout: camera view with the pose skeleton, rep counter and stake. */
export default function PhoneMock({ art, className }: { art: ExerciseArt; className?: string }) {
  return (
    <div
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
          <svg viewBox="0 0 420 420" preserveAspectRatio="xMidYMid slice" className={styles.skeleton}>
            {BONES.map(([a, b]) => (
              <line key={`${a}-${b}`} x1={JOINTS[a][0]} y1={JOINTS[a][1]} x2={JOINTS[b][0]} y2={JOINTS[b][1]} />
            ))}
            {Object.entries(JOINTS).map(([name, [x, y]]) => (
              <circle key={name} cx={x} cy={y} r={name === "head" ? 6 : 4.5} />
            ))}
          </svg>
          <span className={styles.angle}>Elbow 84°</span>
        </div>
        <div className={styles.counter}>
          <span className={styles.reps}>17</span>
          <span className={styles.goal}>/ 20 reps</span>
        </div>
        <div className={styles.bar}>
          <span style={{ width: "85%" }} />
        </div>
        <div className={styles.challenge}>
          <span className={styles.challengeTag}>Challenge</span>
          <span>Raise your right hand</span>
        </div>
        <div className={styles.stake}>
          <span>Today&apos;s stake</span>
          <strong>100 SKR</strong>
        </div>
      </div>
    </div>
  );
}
