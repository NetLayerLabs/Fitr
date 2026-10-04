import BackLink from "@/components/common/BackLink";
import type { ReactNode } from "react";
import { ArrowLeftIcon, CameraIcon, ExerciseIcon, PlayIcon, ShieldIcon } from "@/components/icons/Icons";
import { EXERCISES } from "@/lib/exercises";
import type { ExerciseKind } from "@/lib/pose/types";
import { formatGoal } from "./format";
import styles from "./WorkoutScreen.module.css";

export type CameraFacing = "user" | "environment";

export interface SetupViewProps {
  exercise: ExerciseKind;
  facing: CameraFacing;
  onFacingChange: (facing: CameraFacing) => void;
  onStart: () => void;
  /** Re-opens the form guide (also reachable after "don't show again"). */
  onOpenGuide?: () => void;
  /** Goal to show: the staked goal when there is one, else the exercise default. */
  goal?: number;
  /** Today's stake note (StakeBanner), when the wallet has one. */
  stake?: ReactNode;
  /** A verified (staked) run uploads pose points, never video: the privacy note says so. */
  verified?: boolean;
}

const FACING_OPTIONS: ReadonlyArray<{ value: CameraFacing; label: string; hint: string }> = [
  { value: "user", label: "Front", hint: "Watch the counter" },
  { value: "environment", label: "Back", hint: "Sharper tracking" },
];

/**
 * Applies to every exercise: the posture checks need image-down to be gravity, and counting
 * pauses while the phone is on its side or upside down (see runtime/orientation.ts).
 */
const UPRIGHT_TIP =
  "Stand the phone upright in portrait, not lying flat or on its side. Counting pauses while it is sideways or upside down.";

/** Pre-workout screen: goal, setup tips, camera choice and the Start button (the user gesture). */
export default function SetupView({
  exercise,
  facing,
  onFacingChange,
  onStart,
  onOpenGuide,
  goal,
  stake,
  verified = false,
}: SetupViewProps) {
  const info = EXERCISES[exercise];
  const shownGoal = goal ?? info.defaultGoal;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <BackLink fallback="/workouts" className={styles.backLink} label="Back">
          <ArrowLeftIcon size={24} />
        </BackLink>
        <p className={styles.pageEyebrow}>Workout</p>
      </header>

      <div className={styles.hero}>
        <span className={styles.heroIcon} aria-hidden="true">
          <ExerciseIcon kind={exercise} size={36} />
        </span>
        <h1 className={styles.heroTitle}>{info.name}</h1>
        <p className={styles.heroTagline}>{info.tagline}</p>
        <dl className={styles.heroStats}>
          <div className={styles.heroStat}>
            <dt>Goal</dt>
            <dd>{formatGoal(shownGoal, info.unit)}</dd>
          </div>
          <div className={styles.heroStat}>
            <dt>Camera</dt>
            <dd>{info.camera === "front" ? "Face it" : "Side-on"}</dd>
          </div>
          <div className={styles.heroStat}>
            <dt>Level</dt>
            <dd>{info.level[0].toUpperCase() + info.level.slice(1)}</dd>
          </div>
        </dl>
      </div>

      {stake}

      {onOpenGuide && (
        <button type="button" className={styles.secondaryButton} onClick={onOpenGuide}>
          <PlayIcon size={18} />
          Watch the form guide
        </button>
      )}

      <section className={styles.card} aria-labelledby="setup-tips-heading">
        <h2 id="setup-tips-heading" className={styles.cardTitle}>
          Set up your phone
        </h2>
        <ol className={styles.tips}>
          {[...info.setupTips, UPRIGHT_TIP].map((tip, i) => (
            <li key={tip} className={styles.tip}>
              <span className={styles.tipIndex} aria-hidden="true">
                {i + 1}
              </span>
              <p>{tip}</p>
            </li>
          ))}
        </ol>
      </section>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>
          <CameraIcon size={18} />
          Camera
        </legend>
        <div className={styles.chips}>
          {FACING_OPTIONS.map((option) => (
            <label key={option.value} className={styles.chip}>
              <input
                type="radio"
                name="camera-facing"
                value={option.value}
                checked={facing === option.value}
                onChange={() => onFacingChange(option.value)}
                className={styles.chipInput}
              />
              <span className={styles.chipLabel}>{option.label}</span>
              <span className={styles.chipHint}>{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className={styles.privacyNote}>
        <ShieldIcon size={18} />
        {verified
          ? "Tracking runs on this device. Video never leaves your phone; only body-point data goes to Fitr's verifier."
          : "Tracking runs on this device. Video is never uploaded or recorded."}
      </p>

      <div className={styles.stickyActions}>
        <button type="button" className={styles.ctaButton} onClick={onStart}>
          <span className={styles.ctaLabel}>Start {info.name.toLowerCase()}</span>
          <span className={styles.ctaCap} aria-hidden="true">
            <PlayIcon size={22} />
          </span>
        </button>
      </div>
    </div>
  );
}
