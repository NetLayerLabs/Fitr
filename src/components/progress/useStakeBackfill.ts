"use client";

import { useEffect, useState } from "react";
import { getBase58Encoder, type Address, type Signature } from "@solana/kit";
import { getBrowserRpc } from "@/lib/solana/rpc";
import { getUserDayAddresses, vaultProgramAddress } from "@/lib/solana/vault/addresses";
import { COMMIT_DISCRIMINATOR, getCommitInstructionDataDecoder } from "@/lib/solana/vault/generated";
import type { VaultSnapshot } from "@/lib/solana/vault/read";
import type { WorkoutSession } from "@/lib/storage/history";
import { loadStakes, recordStake } from "@/lib/storage/stakes";

const CHECKED_KEY = "fitr.stakeBackfill.v1";
/** Days checked per visit (each costs one or two RPC reads). */
const MAX_DAYS_PER_RUN = 8;

function readChecked(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(CHECKED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function writeChecked(set: Set<string>): void {
  try {
    window.localStorage.setItem(CHECKED_KEY, JSON.stringify([...set].slice(-500)));
  } catch {
    // ignore
  }
}

const sameBytes = (a: ArrayLike<number>, b: ArrayLike<number>) => a.length >= b.length && Array.from(b).every((v, i) => a[i] === v);

/**
 * Stakes made before this device kept a stake log (or on another device): for each past day with
 * a workout and no record, look for the global-pool Commitment's signatures (they outlive the
 * closed account) and read the amount from the commit instruction. Fills lib/storage/stakes once
 * per day; returns a counter that changes when something was added.
 */
export function useStakeBackfill(
  owner: Address | null,
  snapshot: Pick<VaultSnapshot, "poolAddress" | "cfg" | "today"> | null,
  sessions: readonly WorkoutSession[],
): number {
  const [version, setVersion] = useState(0);
  const pool = snapshot?.poolAddress ?? null;
  const len = snapshot ? Number(snapshot.cfg.dayLengthSecs) : 0;
  const offset = snapshot ? Number(snapshot.cfg.dayOffsetSecs) : 0;
  const today = snapshot?.today ?? null;

  useEffect(() => {
    if (!owner || !pool || !len || today === null) return;
    let cancelled = false;
    (async () => {
      const recorded = new Set(loadStakes().filter((s) => s.owner === owner && s.crewId === "0").map((s) => s.day));
      const checked = readChecked();
      const days = [...new Set(sessions.map((s) => Math.floor((s.endedAt / 1000 - offset) / len)))]
        .filter((d) => d < today && d >= today - 63 && !recorded.has(d) && !checked.has(`${owner}:${d}`))
        .sort((a, b) => b - a)
        .slice(0, MAX_DAYS_PER_RUN);
      if (days.length === 0) return;
      const rpc = getBrowserRpc();
      const program = vaultProgramAddress();
      const decoder = getCommitInstructionDataDecoder();
      const b58 = getBase58Encoder();
      let added = false;
      for (const day of days) {
        if (cancelled) return;
        try {
          const { commitment } = await getUserDayAddresses({ pool, user: owner, dayIndex: day });
          const sigs = await rpc.getSignaturesForAddress(commitment, { limit: 10 }).send();
          if (sigs.length > 0) {
            // The oldest signature on the Commitment is the commit itself.
            const first = sigs[sigs.length - 1].signature as Signature;
            const tx = await rpc.getTransaction(first, { encoding: "json", maxSupportedTransactionVersion: 0 }).send();
            const msg = tx?.transaction.message;
            const keys = msg ? [...msg.accountKeys, ...(tx?.meta?.loadedAddresses?.writable ?? []), ...(tx?.meta?.loadedAddresses?.readonly ?? [])] : [];
            for (const ix of msg?.instructions ?? []) {
              if (keys[ix.programIdIndex] !== program) continue;
              const data = b58.encode(ix.data);
              if (!sameBytes(data, COMMIT_DISCRIMINATOR)) continue;
              const decoded = decoder.decode(data);
              if (decoded.dayIndex !== day) continue;
              recordStake({ day, crewId: "0", amount: decoded.amount.toString(), owner });
              added = true;
              break;
            }
          }
          checked.add(`${owner}:${day}`);
        } catch {
          // Network or rate limit: try this day again on a later visit.
        }
      }
      writeChecked(checked);
      if (added && !cancelled) setVersion((v) => v + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, pool, len, offset, today, sessions]);

  return version;
}
