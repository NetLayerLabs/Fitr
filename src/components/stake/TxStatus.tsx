"use client";

import { AlertIcon } from "@/components/icons/Icons";
import Button from "@/components/ui/Button";
import { solanaConfig } from "@/lib/solana/config";
import type { VaultTxPhase } from "./useVaultTx";
import styles from "./stake.module.css";

const STEPS: Array<{ phase: VaultTxPhase; label: string }> = [
  { phase: "preparing", label: "Preparing" },
  { phase: "simulating", label: "Checking with the network" },
  { phase: "signing", label: "Approve in your wallet" },
  { phase: "confirming", label: "Confirming on-chain" },
];

export function TxProgress({ phase }: { phase: VaultTxPhase }) {
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
            {s.label}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ExplorerLink({ signature }: { signature: string }) {
  return (
    <a className={styles.explorer} href={solanaConfig.explorerTxUrl(signature)} target="_blank" rel="noreferrer noopener">
      View on Solana Explorer<span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function TxError({
  message,
  signature,
  onDismiss,
}: {
  message: string;
  signature: string | null;
  onDismiss: () => void;
}) {
  return (
    <div className={styles.txError} role="alert">
      <AlertIcon size={20} />
      <div className={styles.txErrorBody}>
        <p>{message}</p>
        {signature ? <ExplorerLink signature={signature} /> : null}
      </div>
      <Button variant="ghost" onClick={onDismiss}>
        OK
      </Button>
    </div>
  );
}
