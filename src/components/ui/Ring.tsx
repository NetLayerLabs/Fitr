import type { ReactNode } from "react";
import styles from "./Ring.module.css";

export interface RingProps {
  /** 0..1; clamped, NaN treated as 0. */
  fraction: number;
  /** Outer diameter in px. Default 200. */
  size?: number;
  /** Stroke width in px. Default 12. */
  stroke?: number;
  /** Centered content (e.g. the countdown numeral). Hidden from AT; the label carries the meaning. */
  children?: ReactNode;
  /** Accessible name of the progressbar, e.g. "Reps completed". */
  label: string;
  /** Optional spoken value, e.g. "7 of 20 reps". Defaults to the percentage. */
  valueText?: string;
}

export function clampFraction(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(1, Math.max(0, fraction));
}

/** Circular progress / countdown ring: lime arc on a quiet track, starting at 12 o'clock. */
export default function Ring({ fraction, size = 200, stroke = 12, children, label, valueText }: RingProps) {
  const f = clampFraction(fraction);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const percent = Math.round(f * 100);
  return (
    <div
      className={styles.ring}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={valueText}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle className={styles.track} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className={styles.arc}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - f)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          data-fraction={f}
          opacity={f === 0 ? 0 : 1}
        />
      </svg>
      {children !== undefined ? (
        <div className={styles.center} aria-hidden="true">
          {children}
        </div>
      ) : null}
    </div>
  );
}
