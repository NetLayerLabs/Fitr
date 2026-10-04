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
import { useNativeReminders } from "@/components/native/useNativeReminders";
import { setPreference, usePreferences } from "./preferences";
import styles from "./You.module.css";

function useGuidePrefs() {
  return useSyncExternalStore(subscribeGuidePrefs, getGuidePrefs, getServerGuidePrefs);
}

function remindersHint(enabled: boolean, permission: string): string {
  if (!enabled) return "Off. Fitr won't nudge you before a stake deadline.";
  if (permission === "denied") return "Notifications are blocked for Fitr. Tap the switch to open Android settings.";
  if (permission !== "granted") return "Allow notifications so Fitr can remind you before your deadline.";
  return "A nudge 2 hours before your stake deadline, and a last call 30 minutes before.";
}

/** Clock-in reminders: only inside the Android app, where the native bridge can post notifications. */
function RemindersSetting() {
  const reminders = useNativeReminders();
  if (!reminders.available) return null;
  const { enabled, permission } = reminders;
  // A switch that is on but cannot notify is shown as off, so tapping it fixes the permission.
  const effective = enabled && permission === "granted";
  return (
    <div className={styles.setting} data-inline="">
      <div className={styles.settingText}>
        <p className={styles.settingTitle} id="setting-reminders">
          Clock-in reminders
        </p>
        <p className={styles.settingHint} id="setting-reminders-hint" role="status">
          {remindersHint(enabled, permission)}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={effective}
        aria-labelledby="setting-reminders"
        aria-describedby="setting-reminders-hint"
        className={styles.switch}
        onClick={() => reminders.setEnabled(!effective)}
      >
        <span className={styles.switchThumb} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Default camera, haptics, voice coach and form-guide settings. All stored on this device only. */
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

      <div className={styles.setting} data-inline="">
        <div className={styles.settingText}>
          <p className={styles.settingTitle} id="setting-voice">
            Voice coach
          </p>
          <p className={styles.settingHint} id="setting-voice-hint">
            Counts your reps out loud and calls form cues and live checks, so you never need to read the screen.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.voiceCoach}
          aria-labelledby="setting-voice"
          aria-describedby="setting-voice-hint"
          className={styles.switch}
          onClick={() => setPreference("voiceCoach", !prefs.voiceCoach)}
        >
          <span className={styles.switchThumb} aria-hidden="true" />
        </button>
      </div>

      <RemindersSetting />

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
