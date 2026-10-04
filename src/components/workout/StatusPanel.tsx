"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./WorkoutScreen.module.css";

export interface StatusPanelProps {
  tone: "info" | "loading" | "error";
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}

/**
 * Centered card over the camera stage for permission / loading / error states.
 *
 * The card is the screen's main content while it shows, so its title is the page heading and
 * takes focus whenever it changes (Start -> "Starting camera" -> "Loading pose model" -> an
 * error): keyboard and screen-reader users are never left on <body> with nothing announced.
 * Errors also use role="alert". No aria-busy: its text *is* the status to announce.
 */
export default function StatusPanel({ tone, icon, title, children, actions }: StatusPanelProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [title]);

  return (
    <div className={styles.statusLayer}>
      <div className={styles.statusCard} data-tone={tone} role={tone === "error" ? "alert" : "status"}>
        {tone === "loading" ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : icon ? (
          <span className={styles.statusIcon} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <h1 ref={headingRef} tabIndex={-1} className={styles.statusTitle}>
          {title}
        </h1>
        {children ? <div className={styles.statusBody}>{children}</div> : null}
        {actions ? <div className={styles.statusActions}>{actions}</div> : null}
      </div>
    </div>
  );
}
