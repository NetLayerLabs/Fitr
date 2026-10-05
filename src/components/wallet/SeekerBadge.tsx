"use client";

import { ShieldIcon } from "@/components/icons/Icons";
import type { AsyncState, SeekerStatus } from "@/lib/solana/types";
import styles from "./Wallet.module.css";
import { useT } from "@/lib/i18n/I18nProvider";

/** Seeker Genesis Token result as a small status pill. */
export default function SeekerBadge({ state }: { state: AsyncState<SeekerStatus> }) {
  const t = useT("wallet");
  if (state.status === "idle") return null;
  const seeker = state.data?.isSeeker;
  let tone: "ok" | "muted" | "warn" = "muted";
  let text = t("seekerChecking");
  if (state.status === "error" && !state.data) {
    tone = "warn";
    text = t("seekerUnavailable");
  } else if (state.data) {
    tone = seeker ? "ok" : "muted";
    text = seeker ? t("seekerVerified") : t("seekerMissing");
  }
  return (
    <span className={styles.badge} data-tone={tone} role="status">
      {seeker ? <ShieldIcon size={14} /> : null}
      {text}
    </span>
  );
}
