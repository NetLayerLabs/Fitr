"use client";

import { AlertIcon } from "@/components/icons/Icons";
import Button from "@/components/ui/Button";
import { solanaConfig } from "@/lib/solana/config";
import type { VaultTxPhase } from "./useVaultTx";
import styles from "./stake.module.css";
import { useT } from "@/lib/i18n/I18nProvider";

const STEPS = [
  { phase: "preparing", label: "stepPreparing" },
  { phase: "simulating", label: "stepSimulating" },
  { phase: "signing", label: "stepSigning" },
  { phase: "confirming", label: "stepConfirming" },
] as const satisfies ReadonlyArray<{ phase: VaultTxPhase; label: string }>;

export function TxProgress({ phase }: { phase: VaultTxPhase }) {
  const t = useT("stake");
  const current = STEPS.findIndex((s) => s.phase === phase);
  if (current === -1) return null;
  return (
    <div className={styles.progress} role="status" aria-live="polite">
      <ol className={styles.progressList}>
        {STEPS.map((s, i) => (
          <li
            key={s.phase}
            className={`${styles.progressStep} ${i < current ? styles.progressDone : ""} ${i === current ? styles.progressNow : ""}`}
            aria-current={i === current ? "step" : undefined}
          >
            <span className={styles.progressDot} aria-hidden="true" />
            {t(s.label)}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ExplorerLink({ signature }: { signature: string }) {
  const t = useT("stake");
  return (
    <a className={styles.explorer} href={solanaConfig.explorerTxUrl(signature)} target="_blank" rel="noreferrer noopener">
      {t("viewOnExplorer")}
      <span className="sr-only">{t("opensInNewTab")}</span>
    </a>
  );
}

export function TxError({
  message,
  signature,
  detail,
  onDismiss,
}: {
  message: string;
  signature: string | null;
  /** Raw technical reason, behind a disclosure (helps support from a screenshot). */
  detail?: string | null;
  onDismiss: () => void;
}) {
  const t = useT("stake");
  return (
    <div className={styles.txError} role="alert">
      <AlertIcon size={20} />
      <div className={styles.txErrorBody}>
        <p>{message}</p>
        {signature ? <ExplorerLink signature={signature} /> : null}
        {detail ? (
          <details className={styles.txErrorDetail}>
            <summary>{t("technicalDetails")}</summary>
            <code>{detail}</code>
          </details>
        ) : null}
      </div>
      <Button variant="ghost" onClick={onDismiss}>
        {t("ok")}
      </Button>
    </div>
  );
}
