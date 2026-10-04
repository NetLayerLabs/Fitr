import styles from "./WorkoutScreen.module.css";

export interface ReadyCountdownProps {
  /** Seconds left (3, 2, 1). */
  value: number;
  total: number;
  /** Shown under the numeral, e.g. the goal. */
  detail?: string;
  onSkip: () => void;
}

/**
 * Full-bleed lime "Ready to go" moment over the camera while the user gets into position. Not a
 * dialog and never takes focus: tracking is already running underneath, so the HUD (and End)
 * stay reachable for keyboard and screen-reader users; the count is announced politely.
 */
export default function ReadyCountdown({ value, total, detail, onSkip }: ReadyCountdownProps) {
  const fraction = total > 0 ? value / total : 0;
  const size = 232;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={styles.countdown} data-testid="ready-countdown">
      <p className={styles.countdownEyebrow}>Ready to go</p>
      <div className={styles.countdownRing} aria-hidden="true">
        <svg viewBox={`0 0 ${size} ${size}`} className={styles.ringSvg}>
          <circle className={styles.countdownTrack} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
          <circle
            className={styles.countdownFill}
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - fraction)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <span key={value} className={styles.countdownValue}>
          {value}
        </span>
      </div>
      {detail ? <p className={styles.countdownDetail}>{detail}</p> : null}
      <p className="sr-only" aria-live="polite">
        Starting in {value}
      </p>
      <button type="button" className={styles.countdownSkip} onClick={onSkip}>
        Skip countdown
      </button>
    </div>
  );
}
