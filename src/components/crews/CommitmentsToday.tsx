"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import { SkrText } from "@/components/brand/SkrAmount";
import { useT } from "@/lib/i18n/I18nProvider";
import { exerciseGoal } from "@/lib/i18n/exercise";
import { crewPath } from "@/lib/solana/vault/crews";
import { commitmentsToday, workoutHrefFor, type PoolTodayCommitment } from "./multiPool";
import styles from "./crews.module.css";

const TAG: Partial<Record<PoolTodayCommitment["state"], { label: "tagToDo" | "tagVerifying" | "tagVerified" | "tagClaim" | "tagMissed" | "tagWithdrawn"; tone?: "lime" | "warn" | "danger" }>> = {
  committed: { label: "tagToDo", tone: "warn" },
  verifying: { label: "tagVerifying" },
  verified: { label: "tagVerified", tone: "lime" },
  claimable: { label: "tagClaim", tone: "lime" },
  missed: { label: "tagMissed", tone: "danger" },
  revoked: { label: "tagWithdrawn", tone: "danger" },
};

function hrefFor(c: PoolTodayCommitment): string {
  if (c.state === "committed" && c.exercise && c.forDay === "today") return workoutHrefFor(c.exercise, c.crewId);
  return c.crewId === 0n ? "/commit" : crewPath(c.crewId);
}

/**
 * "Your commitments today" across the global pool and crews. Only shown once a crew is involved:
 * with the global pool alone, the Commit tab's own panel already shows it.
 */
export default function CommitmentsToday({ pools }: { pools: readonly PoolTodayCommitment[] }) {
  const t = useT("crews");
  const tx = useT("exercises");
  const rows = commitmentsToday(pools);
  if (rows.length === 0 || rows.every((r) => r.crewId === 0n)) return null;
  return (
    <Card as="section" padding="md" aria-labelledby="pools-today-title">
      <h2 id="pools-today-title" className={styles.sectionTitle}>
        {t("commitmentsTodayTitle")}
      </h2>
      <ul className={`${styles.list} ${styles.listSpaced}`} role="list">
        {rows.map((c) => {
          const tag = TAG[c.state];
          return (
            <li key={c.crewId.toString()}>
              <Link href={hrefFor(c)} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{c.crewId === 0n ? t("soloName") : c.crewName}</span>
                  <span className={styles.rowMeta}>
                    {c.exercise && c.goalTarget !== undefined ? exerciseGoal(tx, c.exercise, c.goalTarget) : t("goalFallback")}
                    {c.amountLabel ? (
                      <>
                        {" · "}
                        <SkrText text={c.amountLabel} />
                      </>
                    ) : null}
                    {c.forDay === "tomorrow" ? ` · ${t("forTomorrow")}` : null}
                  </span>
                </span>
                {tag ? (
                  <span className={styles.tag} data-tone={tag.tone}>
                    {t(tag.label)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
