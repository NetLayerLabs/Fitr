import ShareVerifiedButton from "@/components/public/ShareVerifiedButton";
import { AlertIcon, CheckIcon, RefreshIcon, ShieldIcon } from "@/components/icons/Icons";
import type { GoalUnit } from "@/lib/exercises";
import { verifyReasonCopy, type VerifiedStatus, type VerifyOutcome } from "@/hooks/useVerifiedSession";
import { useT } from "@/lib/i18n/I18nProvider";
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
  const t = useT("workout");
  if (status === "starting" || status === "recording" || status === "finishing") {
    return (
      <section className={styles.verifyCard} data-tone="pending" role="status" aria-label={t("verification")}>
        <span className={styles.spinnerSmall} aria-hidden="true" />
        <div>
          <p className={styles.verifyTitle}>{t("verifying")}</p>
          <p className={styles.verifyText}>{t("verifyingText")}</p>
        </div>
      </section>
    );
  }

  if (outcome?.kind === "verified") {
    return (
      <section className={styles.verifyCard} data-tone="ok" aria-label={t("verification")}>
        <span className={styles.verifyIcon} aria-hidden="true">
          <CheckIcon size={22} />
        </span>
        <div>
          <p className={styles.verifyTitle}>{t("verifiedOnchain")}</p>
          <p className={styles.verifyText}>
            {t("verifiedText", { count: formatValue(outcome.count, unit), goal: formatGoal(outcome.goalTarget, unit, t) })}
          </p>
          {outcome.explorerUrl ? (
            <a className={styles.verifyLink} href={outcome.explorerUrl} target="_blank" rel="noopener noreferrer">
              {t("viewTransaction")}
            </a>
          ) : null}
          <ShareVerifiedButton dayIndex={shareDayIndex} crewId={shareCrewId || null} label={formatGoal(outcome.count, unit, t)} />
        </div>
      </section>
    );
  }

  if (outcome?.kind === "failed") {
    const reasons = outcome.reasons.length > 0 ? outcome.reasons : ["unknown"];
    return (
      <section className={styles.verifyCard} data-tone="fail" role="alert" aria-label={t("verification")}>
        <span className={styles.verifyIcon} aria-hidden="true">
          <AlertIcon size={22} />
        </span>
        <div>
          <p className={styles.verifyTitle}>{t("notVerified")}</p>
          <p className={styles.verifyText}>
            {t("notVerifiedText", { count: formatValue(outcome.count, unit), goal: formatGoal(outcome.goalTarget, unit, t) })}
          </p>
          <ul className={styles.verifyReasons}>
            {[...new Set(reasons.map((r) => verifyReasonCopy(r, t)))].map((copy) => (
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
      <section className={styles.verifyCard} data-tone="fail" role="alert" aria-label={t("verification")}>
        <span className={styles.verifyIcon} aria-hidden="true">
          <ShieldIcon size={22} />
        </span>
        <div>
          <p className={styles.verifyTitle}>{t("notVerifiedYet")}</p>
          <p className={styles.verifyText}>{message}</p>
          {retryable ? (
            <button type="button" className={styles.verifyRetry} onClick={onRetry}>
              <RefreshIcon size={18} />
              {t("retryVerification")}
            </button>
          ) : null}
        </div>
      </section>
    );
  }
  return null;
}
