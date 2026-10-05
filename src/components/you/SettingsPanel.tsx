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
import { useT } from "@/lib/i18n/I18nProvider";
import type { Translator } from "@/lib/i18n";
import { setPreference, usePreferences } from "./preferences";
import styles from "./You.module.css";

function useGuidePrefs() {
  return useSyncExternalStore(subscribeGuidePrefs, getGuidePrefs, getServerGuidePrefs);
}

function remindersHint(t: Translator<"you">, enabled: boolean, permission: string): string {
  if (!enabled) return t("remindersOff");
  if (permission === "denied") return t("remindersBlocked");
  if (permission !== "granted") return t("remindersAllow");
  return t("remindersOn");
}

/** Clock-in reminders: only inside the Android app, where the native bridge can post notifications. */
function RemindersSetting() {
  const t = useT("you");
  const reminders = useNativeReminders();
  if (!reminders.available) return null;
  const { enabled, permission } = reminders;
  // A switch that is on but cannot notify is shown as off, so tapping it fixes the permission.
  const effective = enabled && permission === "granted";
  return (
    <div className={styles.setting} data-inline="">
      <div className={styles.settingText}>
        <p className={styles.settingTitle} id="setting-reminders">
          {t("remindersTitle")}
        </p>
        <p className={styles.settingHint} id="setting-reminders-hint" role="status">
          {remindersHint(t, enabled, permission)}
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
  const t = useT("you");
  const prefs = usePreferences();
  const guides = useGuidePrefs();
  const hidden = EXERCISE_KINDS.filter((kind) => guides[kind]);

  return (
    <div className={styles.settings}>
      <div className={styles.setting}>
        <div className={styles.settingText}>
          <p className={styles.settingTitle} id="setting-camera">
            {t("cameraTitle")}
          </p>
          <p className={styles.settingHint}>{t("cameraHint")}</p>
        </div>
        <ChipRow label={t("cameraTitle")}>
          <Chip selected={prefs.camera === "user"} onClick={() => setPreference("camera", "user")}>
            {t("cameraFront")}
          </Chip>
          <Chip selected={prefs.camera === "environment"} onClick={() => setPreference("camera", "environment")}>
            {t("cameraBack")}
          </Chip>
        </ChipRow>
      </div>

      <div className={styles.setting} data-inline="">
        <div className={styles.settingText}>
          <p className={styles.settingTitle} id="setting-haptics">
            {t("hapticsTitle")}
          </p>
          <p className={styles.settingHint} id="setting-haptics-hint">
            {t("hapticsHint")}
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
            {t("voiceCoachTitle")}
          </p>
          <p className={styles.settingHint} id="setting-voice-hint">
            {t("voiceCoachHint")}
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
          <p className={styles.settingTitle}>{t("formGuidesTitle")}</p>
          <p className={styles.settingHint} role="status">
            {hidden.length === 0
              ? t("formGuidesAllShown")
              : t.plural("formGuidesHidden", hidden.length)}
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={hidden.length === 0}
          onClick={() => {
            for (const kind of hidden) setGuideHidden(kind, false);
          }}
        >
          {t("formGuidesShowAll")}
        </Button>
      </div>
    </div>
  );
}
