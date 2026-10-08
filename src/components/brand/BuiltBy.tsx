import NetLayerMark from "./NetLayerMark";
import styles from "./BuiltBy.module.css";

export const NETLAYER_URL = "https://www.netlayerlabs.com/";

/**
 * "Built by NetLayer Labs": the studio signature, with the studio's own mark, linking to
 * netlayerlabs.com. A soft light sweeps across the mark as it scrolls into view; a lime edge on
 * hover/focus; still under reduced motion.
 */
export default function BuiltBy({ label = "Built by", className }: { label?: string; className?: string }) {
  return (
    <a
      href={NETLAYER_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className ? `${styles.signature} ${className}` : styles.signature}
    >
      <span className={styles.mark}>
        <NetLayerMark size={40} />
      </span>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        <span className={styles.name}>NetLayer Labs</span>
      </span>
      <span className="sr-only"> (netlayerlabs.com, opens in a new tab)</span>
    </a>
  );
}
