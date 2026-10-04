import type { ReactNode } from "react";
import styles from "./text.module.css";

/**
 * Wraps hyphenated words ("push-up", "Sit-ups") in a no-wrap span so a narrow line never
 * breaks at the hyphen. The text content is unchanged, so accessible names stay the same.
 */
export function keepHyphenatedWords(text: string): ReactNode[] {
  return text.split(/(\S+-\S+)/).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className={styles.nowrap}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}
