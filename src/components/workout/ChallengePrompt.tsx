"use client";

import { useEffect, useState } from "react";
import type { LiveChallenge } from "@/hooks/useVerifiedSession";
import styles from "./WorkoutScreen.module.css";

export interface ChallengePromptProps {
  challenge: LiveChallenge;
  /** Epoch ms clock (injectable for tests). */
  now?: () => number;
}

/**
 * The live check, impossible to miss: a lime banner across the camera with the instruction in
 * huge type and a shrinking countdown bar. role="alert" so screen readers announce it at once.
 */
export default function ChallengePrompt({ challenge, now = Date.now }: ChallengePromptProps) {
  const [t, setT] = useState(() => now());
  useEffect(() => {
    const id = setInterval(() => setT(now()), 250);
    return () => clearInterval(id);
  }, [now]);
  const remainingMs = Math.max(0, challenge.deadline - t);
  const seconds = Math.ceil(remainingMs / 1000);
  const fraction = challenge.windowMs > 0 ? Math.min(1, remainingMs / challenge.windowMs) : 0;
  return (
    <div className={styles.challenge} role="alert">
      <p className={styles.challengeEyebrow}>
        <span className={styles.challengeDot} aria-hidden="true" />
        Live check
      </p>
      <p className={styles.challengePrompt}>{challenge.prompt}</p>
      <div className={styles.challengeFooter}>
        <span className={styles.challengeBar} aria-hidden="true">
          <span className={styles.challengeBarFill} style={{ transform: `scaleX(${fraction})` }} />
        </span>
        <span className={styles.challengeSeconds}>
          {seconds}
          <span className="sr-only"> seconds left</span>
          <span aria-hidden="true">s</span>
        </span>
      </div>
    </div>
  );
}
