import ShareVerifiedButton from "@/components/public/ShareVerifiedButton";
import { AlertIcon, CheckIcon, RefreshIcon, ShieldIcon } from "@/components/icons/Icons";
import type { GoalUnit } from "@/lib/exercises";
import { verifyReasonCopy, type VerifiedStatus, type VerifyOutcome } from "@/hooks/useVerifiedSession";
import { formatGoal, formatValue } from "./format";
import styles from "./WorkoutScreen.module.css";

export interface VerificationCardProps {
  status: VerifiedStatus;
  outcome: VerifyOutcome | null;
  /** Connection / start problem without a verdict. */
  error: string | null;
  unit: GoalUnit;
  /** Retry the onchain submission (when the outcome is retryable). */
  onRetry?: () => void;
  /** Pool day of the verified stake, for the Share link (looked up on tap when omitted). */
  shareDayIndex?: number | null;
  /** Crew of the verified stake (null / 0 = the global pool), so the share card reads the right pool. */
  shareCrewId?: bigint | null;
}

/** Result of the staked verification on the finished screen. Renders nothing for unstaked workouts. */
export default function VerificationCard({ status, outcome, error, unit, onRetry, shareDayIndex = null, shareCrewId = null }: VerificationCardProps) {
  if (status === "starting" || status === "recording" || status === "finishing") {
    return (
      <section className={styles.verifyCard} data-tone="pending" role="status" aria-label="Verification">
        <span className={styles.spinnerSmall} aria-hidden="true" />
        <div>
          <p className={styles.verifyTitle}>Verifying…</p>
          <p className={styles.verifyText}>Fitr&apos;s server is re-checking your workout and recording it on Solana.</p>
        </div>
      </section>
    );
  }

  if (outcome?.kind === "verified") {
    return (
      <section className={styles.verifyCard} data-tone="ok" aria-label="Verification">
        <span className={styles.verifyIcon} aria-hidden="true">
          <CheckIcon size={22} />
        </span>
        <div>
          <p className={styles.verifyTitle}>Verified onchain ✓</p>
          <p className={styles.verifyText}>
            {formatValue(outcome.count, unit)} of {formatGoal(outcome.goalTarget, unit)} confirmed by the verifier. Your stake is
            claimable once the day settles.
          </p>
          {outcome.explorerUrl ? (
            <a className={styles.verifyLink} href={outcome.explorerUrl} target="_blank" rel="noopener noreferrer">
              View transaction
            </a>
          ) : null}
          <ShareVerifiedButton dayIndex={shareDayIndex} crewId={shareCrewId || null} label={formatGoal(outcome.count, unit)} />
        </div>
      </section>
    );
  }

  if (outcome?.kind === "failed") {
    const reasons = outcome.reasons.length > 0 ? outcome.reasons : ["unknown"];
    return (
      <section className={styles.verifyCard} data-tone="fail" role="alert" aria-label="Verification">
        <span className={styles.verifyIcon} aria-hidden="true">
          <AlertIcon size={22} />
        </span>
        <div>
          <p className={styles.verifyTitle}>Not verified</p>
          <p className={styles.verifyText}>
            The verifier counted {formatValue(outcome.count, unit)} of {formatGoal(outcome.goalTarget, unit)}. Your stake is still
            open: you can try again before today&apos;s deadline.
          </p>
          <ul className={styles.verifyReasons}>
            {[...new Set(reasons.map(verifyReasonCopy))].map((copy) => (
              <li key={copy}>{copy}</li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  const message = outcome?.kind === "error" ? outcome.message : error;
  if (status === "error" && message) {
    const retryable = outcome?.kind === "error" && outcome.retryable && onRetry;
    return (
      <section className={styles.verifyCard} data-tone="fail" role="alert" aria-label="Verification">
        <span className={styles.verifyIcon} aria-hidden="true">
          <ShieldIcon size={22} />
        </span>
        <div>
          <p className={styles.verifyTitle}>Not verified yet</p>
          <p className={styles.verifyText}>{message}</p>
          {retryable ? (
            <button type="button" className={styles.verifyRetry} onClick={onRetry}>
              <RefreshIcon size={18} />
              Retry verification
            </button>
          ) : null}
        </div>
      </section>
    );
  }
  return null;
}
