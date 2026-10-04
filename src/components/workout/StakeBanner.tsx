import Link from "next/link";
import { CheckIcon, ShieldIcon } from "@/components/icons/Icons";
import type { StakedCommitment, VerifiedStatus } from "@/hooks/useVerifiedSession";
import { EXERCISES } from "@/lib/exercises";
import type { ExerciseKind } from "@/lib/pose/types";
import { formatSkr } from "@/lib/solana/format";
import { formatGoal } from "./format";
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
  if (otherExercise) {
    const other = EXERCISES[otherExercise];
    return (
      <p className={styles.stakeNote}>
        Today&apos;s stake is for <Link href={`/workout/${otherExercise}`}>{other.name.toLowerCase()}</Link>. This
        workout won&apos;t be verified.
      </p>
    );
  }
  if (!commitment) return null;
  const info = EXERCISES[commitment.exercise];
  if (status === "already" || commitment.status === "completed") {
    return (
      <section className={styles.stakeBanner} data-tone="done" aria-label="Today's stake">
        <span className={styles.stakeIcon} aria-hidden="true">
          <CheckIcon size={20} />
        </span>
        <div>
          <p className={styles.stakeTitle}>Verified today</p>
          <p className={styles.stakeText}>Your {formatGoal(commitment.goalTarget, info.unit)} are already recorded on-chain. Extra sets are just for you.</p>
        </div>
      </section>
    );
  }
  return (
    <section className={styles.stakeBanner} aria-label="Today's stake">
      <span className={styles.stakeIcon} aria-hidden="true">
        <ShieldIcon size={20} />
      </span>
      <div>
        <p className={styles.stakeTitle}>
          Staked{commitment.crewName ? ` with ${commitment.crewName}` : ""} · <SkrText text={formatSkr(commitment.amount)} /> on{" "}
          {formatGoal(commitment.goalTarget, info.unit)}
        </p>
        <p className={styles.stakeText}>
          This workout is verified live. Watch for live checks on screen and keep going until they are done.
        </p>
        {commitment.alternatives?.length ? (
          <p className={styles.stakeText}>
            Verify for another stake instead:{" "}
            {commitment.alternatives.map((a, i) => (
              <span key={a.crewId.toString()}>
                {i > 0 ? ", " : null}
                {/* A full load: the stake is looked up once per screen. */}
                <a href={workoutHrefFor(commitment.exercise, a.crewId)}>{a.crewId === 0n ? "Solo" : a.crewName}</a>
              </span>
            ))}
            . One workout verifies one stake.
          </p>
        ) : null}
        {status === "error" && error ? <p className={styles.stakeError}>{error}</p> : null}
      </div>
    </section>
  );
}
