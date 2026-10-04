"use client";

import { useSyncExternalStore } from "react";
import { Chip, ChipRow } from "@/components/ui/Chip";
import Button from "@/components/ui/Button";
import { EXERCISE_KINDS } from "@/lib/pose/types";
import {
  getGuidePrefs,
  getServerGuidePrefs,
  setGuideHidden,
  subscribeGuidePrefs,
} from "@/lib/storage/guidePrefs";
import { setPreference, usePreferences } from "./preferences";
import styles from "./You.module.css";

function useGuidePrefs() {
  return useSyncExternalStore(subscribeGuidePrefs, getGuidePrefs, getServerGuidePrefs);
}

/** Default camera, haptics and form-guide settings. All stored on this device only. */
export default function SettingsPanel() {
  const prefs = usePreferences();
  const guides = useGuidePrefs();
  const hidden = EXERCISE_KINDS.filter((kind) => guides[kind]);

  return (
    <div className={styles.settings}>
      <div className={styles.setting}>
        <div className={styles.settingText}>
          <p className={styles.settingTitle} id="setting-camera">
            Default camera
          </p>
          <p className={styles.settingHint}>Which camera a workout opens with. You can still flip it on the workout screen.</p>
        </div>
        <ChipRow label="Default camera">
          <Chip selected={prefs.camera === "user"} onClick={() => setPreference("camera", "user")}>
            Front
          </Chip>
          <Chip selected={prefs.camera === "environment"} onClick={() => setPreference("camera", "environment")}>
            Back
          </Chip>
        </ChipRow>
      </div>

      <div className={styles.setting} data-inline="">
        <div className={styles.settingText}>
          <p className={styles.settingTitle} id="setting-haptics">
            Haptics
          </p>
          <p className={styles.settingHint} id="setting-haptics-hint">
            A short buzz on every counted rep and when you reach your goal.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.haptics}
          aria-labelledby="setting-haptics"
          aria-describedby="setting-haptics-hint"
          className={styles.switch}
          onClick={() => setPreference("haptics", !prefs.haptics)}
        >
          <span className={styles.switchThumb} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.setting}>
        <div className={styles.settingText}>
          <p className={styles.settingTitle}>Form guides</p>
          <p className={styles.settingHint} role="status">
            {hidden.length === 0
              ? "Every exercise shows its form guide before you start."
              : `Hidden for ${hidden.length} ${hidden.length === 1 ? "exercise" : "exercises"}.`}
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={hidden.length === 0}
          onClick={() => {
            for (const kind of hidden) setGuideHidden(kind, false);
          }}
        >
          Show all form guides again
        </Button>
      </div>
    </div>
  );
}
