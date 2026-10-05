import BackLink from "@/components/common/BackLink";
import type { ReactNode } from "react";
import { ArrowLeftIcon } from "@/components/icons/Icons";
import styles from "./PageHeader.module.css";

export interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  /** Trailing control (icon button, link). */
  action?: ReactNode;
  /**
   * When set, shows a back arrow: it returns to the previous in-app page (e.g. the Workouts
   * menu), and goes to this href when the page was opened directly.
   */
  back?: string;
  /** The parent page already applies the safe-area gutters; drop the header's own padding. */
  flush?: boolean;
}

/** Screen header: optional back link, small eyebrow, big tight title, trailing action. */
export default function PageHeader({ title, eyebrow, action, back, flush = false }: PageHeaderProps) {
  return (
    <header className={flush ? `${styles.header} ${styles.flush}` : styles.header}>
      {back !== undefined || action ? (
        <div className={styles.bar}>
          {back !== undefined ? (
            <BackLink fallback={back} className={styles.back}>
              <ArrowLeftIcon size={22} />
            </BackLink>
          ) : (
            <span />
          )}
          {action ? <div className={styles.action}>{action}</div> : null}
        </div>
      ) : null}
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h1 className={styles.title}>{title}</h1>
    </header>
  );
}
