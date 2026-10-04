import type { ReactNode } from "react";
import styles from "./WorkoutScreen.module.css";

export interface ProgressRingProps {
  /** 0..1 (clamped). */
  fraction: number;
  /** Outer size in CSS px. */
  size?: number;
  stroke?: number;
  /** Accessible name of the progressbar. */
  label: string;
  /** Rendered in the middle of the ring. */
  children?: ReactNode;
  tone?: "accent" | "onAccent";
}

/** Circular progress (accessible progressbar 0-100) with content in the middle. */
export default function ProgressRing({ fraction, size = 220, stroke = 10, label, children, tone = "accent" }: ProgressRingProps) {
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={styles.ring}
      data-tone={tone}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(f * 100)}
    >
      <svg className={styles.ringSvg} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className={styles.ringTrack} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className={styles.ringFill}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className={styles.ringContent}>{children}</div>
    </div>
  );
}
