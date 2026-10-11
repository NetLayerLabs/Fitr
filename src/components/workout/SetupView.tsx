import BackLink from "@/components/common/BackLink";
import type { ReactNode } from "react";
import { ArrowLeftIcon, CameraIcon, ExerciseIcon, PlayIcon, ShieldIcon } from "@/components/icons/Icons";
import { EXERCISES } from "@/lib/exercises";
import type { ExerciseKind } from "@/lib/pose/types";
import { exerciseName, exerciseNameInSentence, exerciseSetupTips, exerciseTagline, levelLabel } from "@/lib/i18n/exercise";
import { useT } from "@/lib/i18n/I18nProvider";
import { formatGoal } from "./format";
import ArtPhoto from "@/components/workouts/ArtPhoto";
import { exerciseArt } from "@/lib/exerciseArt";
import guide from "./FormGuide.module.css";
import styles from "./WorkoutScreen.module.css";

export type CameraFacing = "user" | "environment";

export interface SetupViewProps {
  exercise: ExerciseKind;
  facing: CameraFacing;
  onFacingChange: (facing: CameraFacing) => void;
  onStart: () => void;
  /** Still looking up today's stake: Start waits, so a verified run never starts with the wrong goal. */
  checking?: boolean;
  /** A staked run: brief the user on live checks before they start. */
  liveChecks?: boolean;
  /** Re-opens the form guide (also reachable after "don't show again"). */
  onOpenGuide?: () => void;
  /** Goal to show: the staked goal when there is one, else the exercise default. */
  goal?: number;
  /** Today's stake note (StakeBanner), when the wallet has one. */
  stake?: ReactNode;
  /** A verified (staked) run uploads pose points, never video: the privacy note says so. */
  verified?: boolean;
}

const FACING_OPTIONS = [
  { value: "user", label: "facingFront", hint: "facingFrontHint" },
  { value: "environment", label: "facingBack", hint: "facingBackHint" },
] as const satisfies ReadonlyArray<{ value: CameraFacing; label: string; hint: string }>;

/** Pre-workout screen: goal, setup tips, camera choice and the Start button (the user gesture). */
export default function SetupView({
  exercise,
  facing,
  onFacingChange,
  onStart,
  checking = false,
  liveChecks = false,
  onOpenGuide,
  goal,
  stake,
  verified = false,
}: SetupViewProps) {
  const t = useT("workout");
  const tx = useT("exercises");
  const name = exerciseName(tx, exercise);
  const info = EXERCISES[exercise];
  const art = exerciseArt(exercise);
  const shownGoal = goal ?? info.defaultGoal;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <BackLink fallback="/workouts" className={styles.backLink} label={t("back")}>
          <ArrowLeftIcon size={24} />
        </BackLink>
        <p className={styles.pageEyebrow}>{t("workoutEyebrow")}</p>
      </header>

      <div className={styles.hero}>
        {art ? (
          <div className={guide.hero} data-framing={art.framing}>
            {/* Above the fold: the one eager, high-priority image on this screen. */}
            <ArtPhoto art={art} priority className={guide.heroPhoto} sizes="(max-width: 600px) 100vw, 600px" />
            <h1 className={`${styles.heroTitle} ${guide.heroTitle}`}>{name}</h1>
          </div>
        ) : (
          <>
            <span className={styles.heroIcon} aria-hidden="true">
              <ExerciseIcon kind={exercise} size={36} />
            </span>
            <h1 className={styles.heroTitle}>{name}</h1>
          </>
        )}
        <p className={styles.heroTagline}>{exerciseTagline(tx, exercise)}</p>
        <dl className={styles.heroStats}>
          <div className={styles.heroStat}>
            <dt>{t("statGoal")}</dt>
            <dd>{formatGoal(shownGoal, info.unit, t)}</dd>
          </div>
          <div className={styles.heroStat}>
            <dt>{t("statCamera")}</dt>
            <dd>{info.camera === "front" ? t("cameraFaceIt") : t("cameraSideOn")}</dd>
          </div>
          <div className={styles.heroStat}>
            <dt>{t("statLevel")}</dt>
            <dd>{levelLabel(tx, info.level)}</dd>
          </div>
        </dl>
      </div>

      {stake}

      {onOpenGuide && (
        <button type="button" className={styles.secondaryButton} onClick={onOpenGuide}>
          <PlayIcon size={18} />
          {t("watchFormGuide")}
        </button>
      )}

      <section className={styles.card} aria-labelledby="setup-tips-heading">
        <h2 id="setup-tips-heading" className={styles.cardTitle}>
          {t("setupTitle")}
        </h2>
        <ol className={styles.tips}>
          {/* The upright tip applies to every exercise: posture checks need image-down to be gravity,
              and counting pauses while the phone is on its side (see runtime/orientation.ts). */}
          {[...exerciseSetupTips(tx, exercise), t("uprightTip")].map((tip, i) => (
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
          {t("cameraLegend")}
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
              <span className={styles.chipLabel}>{t(option.label)}</span>
              <span className={styles.chipHint}>{t(option.hint)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {liveChecks ? (
        <section className={styles.liveCheckBrief} aria-labelledby="live-check-brief">
          <h2 id="live-check-brief" className={styles.liveCheckBriefTitle}>
            <span className={styles.liveCheckBriefDot} aria-hidden="true" />
            {t("liveCheckBriefTitle")}
          </h2>
          <p>{t("liveCheckBriefBody")}</p>
        </section>
      ) : null}

      <p className={styles.privacyNote}>
        <ShieldIcon size={18} />
        {verified ? t("privacyVerified") : t("privacyLocal")}
      </p>

      <div className={styles.stickyActions}>
        <button type="button" className={styles.ctaButton} onClick={onStart} disabled={checking} aria-busy={checking || undefined}>
          <span className={styles.ctaLabel}>
            {checking ? t("checkingStake") : t("startExercise", { name: exerciseNameInSentence(tx, exercise) })}
          </span>
          <span className={styles.ctaCap} aria-hidden="true">
            <PlayIcon size={22} />
          </span>
        </button>
      </div>
    </div>
  );
}
