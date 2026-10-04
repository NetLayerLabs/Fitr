"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import { SkrText } from "@/components/brand/SkrAmount";
import { EXERCISES } from "@/lib/exercises";
import { crewPath } from "@/lib/solana/vault/crews";
import { formatGoal } from "@/components/stake/form";
import { commitmentsToday, workoutHrefFor, type PoolTodayCommitment } from "./multiPool";
import styles from "./crews.module.css";

const TAG: Partial<Record<PoolTodayCommitment["state"], { label: string; tone?: "lime" | "warn" | "danger" }>> = {
  committed: { label: "To do", tone: "warn" },
  verifying: { label: "Verifying" },
  verified: { label: "Verified", tone: "lime" },
  claimable: { label: "Claim", tone: "lime" },
  missed: { label: "Missed", tone: "danger" },
  revoked: { label: "Withdrawn", tone: "danger" },
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
  const rows = commitmentsToday(pools);
  if (rows.length === 0 || rows.every((r) => r.crewId === 0n)) return null;
  return (
    <Card as="section" padding="md" aria-labelledby="pools-today-title">
      <h2 id="pools-today-title" className={styles.sectionTitle}>
        Your commitments today
      </h2>
      <ul className={`${styles.list} ${styles.listSpaced}`} role="list">
        {rows.map((c) => {
          const info = c.exercise ? EXERCISES[c.exercise] : null;
          const tag = TAG[c.state];
          return (
            <li key={c.crewId.toString()}>
              <Link href={hrefFor(c)} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{c.crewId === 0n ? "Solo" : c.crewName}</span>
                  <span className={styles.rowMeta}>
                    {info && c.goalTarget !== undefined ? formatGoal(info.kind, c.goalTarget) : "Goal"}
                    {c.amountLabel ? (
                      <>
                        {" · "}
                        <SkrText text={c.amountLabel} />
                      </>
                    ) : null}
                    {c.forDay === "tomorrow" ? " · tomorrow" : null}
                  </span>
                </span>
                {tag ? (
                  <span className={styles.tag} data-tone={tag.tone}>
                    {tag.label}
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
