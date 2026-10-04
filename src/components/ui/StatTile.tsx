import type { ReactNode } from "react";
import styles from "./StatTile.module.css";

export interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
}

/**
 * One stat: small uppercase label, a big tight numeral, optional unit and hint. Rendered as a
 * group whose accessible name is the label, so "Streak 12 days" reads as one unit.
 */
export default function StatTile({ label, value, unit, hint }: StatTileProps) {
  return (
    <div className={styles.tile} role="group" aria-label={label}>
      <p className={styles.label} aria-hidden="true">
        {label}
      </p>
      <p className={styles.value}>
        <span className={styles.number}>{value}</span>
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </p>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}
