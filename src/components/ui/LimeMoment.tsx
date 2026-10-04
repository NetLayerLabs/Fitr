import { useId, type ReactNode } from "react";
import styles from "./LimeMoment.module.css";

export interface LimeMomentProps {
  eyebrow?: string;
  title: string;
  /** The hero: a huge numeral (countdown, reps, award). */
  big?: ReactNode;
  children?: ReactNode;
  /** CTAs. Primary Buttons inside render as black pills with lime ink. */
  actions?: ReactNode;
}

/**
 * Full-bleed lime celebration / transition screen (Ready to go, Workout complete, Award
 * unlocked): black ink on lime. Inside, the color tokens are inverted so shared components
 * (Button, Ring, Card) pick up the black-on-lime treatment without extra props.
 */
export default function LimeMoment({ eyebrow, title, big, children, actions }: LimeMomentProps) {
  const titleId = useId();
  return (
    <section className={styles.moment} aria-labelledby={titleId} data-lime-moment="">
      <div className={styles.inner}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1 id={titleId} className={styles.title}>
          {title}
        </h1>
        {big !== undefined ? <div className={styles.big}>{big}</div> : null}
        {children ? <div className={styles.body}>{children}</div> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </section>
  );
}
