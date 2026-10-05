import Link from "next/link";
import { CheckIcon, ShieldIcon } from "@/components/icons/Icons";
import type { StakedCommitment, VerifiedStatus } from "@/hooks/useVerifiedSession";
import { EXERCISES } from "@/lib/exercises";
import type { ExerciseKind } from "@/lib/pose/types";
import { formatSkr } from "@/lib/solana/format";
import { exerciseNameInSentence } from "@/lib/i18n/exercise";
import { useT } from "@/lib/i18n/I18nProvider";
import { formatGoal } from "./format";
import { rich } from "./rich";
import styles from "./WorkoutScreen.module.css";
import { SkrText } from "@/components/brand/SkrAmount";
import { workoutHrefFor } from "@/components/crews/multiPool";

export interface StakeBannerProps {
  status: VerifiedStatus;
  commitment: StakedCommitment | null;
  otherExercise: ExerciseKind | null;
  error: string | null;
}

/** Setup-screen note about today's stake: verified run, already verified, or "your stake is for X". */
export default function StakeBanner({ status, commitment, otherExercise, error }: StakeBannerProps) {
  const t = useT("workout");
  const tx = useT("exercises");
  if (otherExercise) {
    const other = exerciseNameInSentence(tx, otherExercise);
    return (
      <p className={styles.stakeNote}>
        {rich(t("stakeOtherExercise"), { exercise: <Link href={`/workout/${otherExercise}`}>{other}</Link> })}
      </p>
    );
  }
  if (!commitment) return null;
  const info = EXERCISES[commitment.exercise];
  if (status === "already" || commitment.status === "completed") {
    return (
      <section className={styles.stakeBanner} data-tone="done" aria-label={t("todaysStake")}>
        <span className={styles.stakeIcon} aria-hidden="true">
          <CheckIcon size={20} />
        </span>
        <div>
          <p className={styles.stakeTitle}>{t("verifiedToday")}</p>
          <p className={styles.stakeText}>{t("alreadyRecorded", { goal: formatGoal(commitment.goalTarget, info.unit, t) })}</p>
        </div>
      </section>
    );
  }
  return (
    <section className={styles.stakeBanner} aria-label={t("todaysStake")}>
      <span className={styles.stakeIcon} aria-hidden="true">
        <ShieldIcon size={20} />
      </span>
      <div>
        <p className={styles.stakeTitle}>
          {rich(
            commitment.crewName
              ? t("stakedWithCrewOn", { crew: commitment.crewName, goal: formatGoal(commitment.goalTarget, info.unit, t) })
              : t("stakedOn", { goal: formatGoal(commitment.goalTarget, info.unit, t) }),
            { amount: <SkrText text={formatSkr(commitment.amount)} /> },
          )}
        </p>
        <p className={styles.stakeText}>{t("stakeLiveNote")}</p>
        {commitment.alternatives?.length ? (
          <p className={styles.stakeText}>
            {rich(t("otherStakes"), {
              stakes: commitment.alternatives.map((a, i) => (
                <span key={a.crewId.toString()}>
                  {i > 0 ? t("listSeparator") : null}
                  {/* A full load: the stake is looked up once per screen. */}
                  <a href={workoutHrefFor(commitment.exercise, a.crewId)}>{a.crewId === 0n ? t("soloStake") : a.crewName}</a>
                </span>
              )),
            })}
          </p>
        ) : null}
        {status === "error" && error ? <p className={styles.stakeError}>{error}</p> : null}
      </div>
    </section>
  );
}
