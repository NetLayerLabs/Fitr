"use client";

import { useEffect, useState } from "react";
import type { LiveChallenge } from "@/hooks/useVerifiedSession";
import type { ChallengeType } from "@/lib/attest/challenges";
import type { Translator } from "@/lib/i18n";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./WorkoutScreen.module.css";

export interface ChallengePromptProps {
  challenge: LiveChallenge;
  /** Epoch ms clock (injectable for tests). */
  now?: () => number;
}

const PROMPT_KEY: Record<ChallengeType, "challengeRaiseRightHand" | "challengeRaiseLeftHand" | "challengeRaiseHand" | "challengeHoldStillTop"> = {
  raise_right_hand: "challengeRaiseRightHand",
  raise_left_hand: "challengeRaiseLeftHand",
  raise_hand: "challengeRaiseHand",
  hold_still_top: "challengeHoldStillTop",
};

/** The on-screen instruction for a live check: by its type, else the server's (English) prompt. */
export function challengePromptText(challenge: Pick<LiveChallenge, "type" | "prompt">, t: Translator<"workout">): string {
  const key = challenge.type in PROMPT_KEY ? PROMPT_KEY[challenge.type] : null;
  return key ? t(key) : challenge.prompt;
}

/**
 * The live check, impossible to miss: a lime banner across the camera with the instruction in
 * huge type and a shrinking countdown bar. role="alert" so screen readers announce it at once.
 */
export default function ChallengePrompt({ challenge, now = Date.now }: ChallengePromptProps) {
  const tw = useT("workout");
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
        {tw("liveCheck")}
      </p>
      <p className={styles.challengePrompt}>{challengePromptText(challenge, tw)}</p>
      <div className={styles.challengeFooter}>
        <span className={styles.challengeBar} aria-hidden="true">
          <span className={styles.challengeBarFill} style={{ transform: `scaleX(${fraction})` }} />
        </span>
        <span className={styles.challengeSeconds}>
          {seconds}
          <span className="sr-only"> {tw("secondsLeft")}</span>
          <span aria-hidden="true">{tw("secondsUnit")}</span>
        </span>
      </div>
    </div>
  );
}
