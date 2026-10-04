"use client";

import { useId } from "react";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { formatTokenAmount } from "@/lib/solana/format";
import type { Pool } from "@/lib/solana/vault/generated";
import { amountErrorMessage, amountToInput, checkAmount, quickPicks } from "./form";
import styles from "./stake.module.css";

export interface AmountFieldProps {
  text: string;
  onText: (text: string) => void;
  pool: Pick<Pool, "minStake" | "maxStake">;
  /** Wallet balance in base units; null while loading. */
  balance: bigint | null;
  decimals: number;
  label: string;
  /** Show validation errors (after the first interaction or a submit attempt). */
  showError: boolean;
}

/** Stake input + quick picks, bounded by the pool's min/max and the wallet balance. */
export default function AmountField({ text, onText, pool, balance, decimals, label, showError }: AmountFieldProps) {
  const id = useId();
  const check = checkAmount(text, pool, balance, decimals);
  const picks = quickPicks(pool, balance, decimals);
  const error = !check.ok && showError ? amountErrorMessage(check.error, pool, decimals, label) : null;
  const fmt = (a: bigint) => formatTokenAmount(a, decimals, { maxFractionDigits: 2 });

  return (
    <div className={styles.amount}>
      <label htmlFor={id} className={styles.fieldLabel}>
        Stake
      </label>
      <div className={`${styles.amountBox} ${error ? styles.amountBoxError : ""}`}>
        <input
          id={id}
          className={`numeral ${styles.amountInput}`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
          onChange={(e) => onText(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 24))}
        />
        <span className={styles.amountUnit}>{label}</span>
      </div>
      <ChipRow label="Quick amounts">
        {picks.map((p) => (
          <Chip
            key={p.amount.toString()}
            selected={check.ok && check.amount === p.amount}
            disabled={p.disabled}
            onClick={() => onText(amountToInput(p.amount, decimals))}
          >
            {fmt(p.amount)}
          </Chip>
        ))}
      </ChipRow>
      <p id={`${id}-help`} className={styles.hint}>
        {`Min ${fmt(pool.minStake)} · max ${fmt(pool.maxStake)} ${label}`}
        {balance !== null ? ` · balance ${fmt(balance)}` : ""}
      </p>
      {error ? (
        <p id={`${id}-error`} className={styles.fieldError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
