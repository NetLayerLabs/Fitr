import NetLayerMark from "./NetLayerMark";
import styles from "./BuiltBy.module.css";

/**
 * "Built by NetLayer Labs": the studio signature (not a link), with the studio's own mark. A soft
 * light sweeps across the mark as it scrolls into view; still under reduced motion.
 */
export default function BuiltBy({ label = "Built by", className }: { label?: string; className?: string }) {
  return (
    <p className={className ? `${styles.signature} ${className}` : styles.signature}>
      <span className={styles.mark}>
        <NetLayerMark size={40} />
      </span>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        <span className={styles.name}>NetLayer Labs</span>
      </span>
    </p>
  );
}
