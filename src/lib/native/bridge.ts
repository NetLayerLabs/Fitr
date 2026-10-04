/**
 * Bridge to the Fitr Android app (android/fitr-shell). The shell injects `window.FitrNative`
 * via WebView.addJavascriptInterface, ONLY for pages on the app's own origin (https://app.fitr.day).
 * Every function here is safe to call anywhere: in a normal browser (or during SSR) it falls back
 * to a web API or does nothing.
 *
 * CONTRACT (the Kotlin side must implement exactly these methods; arguments are strings/booleans
 * because addJavascriptInterface only passes primitives — structured data is JSON):
 *
 *   version(): string                                  e.g. "1.1.0+3"
 *   speak(text: string, flush: boolean): void          Android TextToSpeech; flush=true interrupts
 *   stopSpeaking(): void
 *   notificationPermission(): string                   "granted" | "denied" | "default"
 *   requestNotificationPermission(): void              POST_NOTIFICATIONS on Android 13+
 *   scheduleReminders(json: string): void              json = ReminderPlan (replaces any previous plan)
 *   cancelReminders(): void
 *   updateWidget(json: string): void                   json = WidgetState (home-screen widget)
 */

export interface ReminderPlan {
  /** When the commitment must be done (epoch ms, the on-chain attest deadline or commit window). */
  deadlineMs: number;
  /** Notify this many minutes before the deadline, e.g. [120, 30]. Past times are skipped. */
  offsetsMin: number[];
  /** Notification title, e.g. "2h left: 20 push-ups". Use {left} for "2h"/"30m". */
  title: string;
  /** Body, e.g. "Finish today or your 50 SKR stake goes to the people who showed up." */
  body: string;
  /** Path opened when the notification is tapped, e.g. "/workout/pushup". */
  openPath: string;
}

export type WidgetMode = "none" | "commit" | "committed" | "verifying" | "verified" | "claimable" | "missed";

export interface WidgetState {
  mode: WidgetMode;
  /** Current daily streak (days). */
  streak: number;
  /** e.g. "20 push-ups" (empty when not committed). */
  goalLabel: string;
  /** e.g. "50 SKR" (empty when not staked). */
  stakeLabel: string;
  /** Epoch ms of the deadline, or 0. */
  deadlineMs: number;
  /** Path the widget opens on tap, e.g. "/" or "/workout/pushup". */
  openPath: string;
}

interface FitrNativeApi {
  version(): string;
  speak(text: string, flush: boolean): void;
  stopSpeaking(): void;
  notificationPermission(): string;
  requestNotificationPermission(): void;
  scheduleReminders(json: string): void;
  cancelReminders(): void;
  updateWidget(json: string): void;
}

declare global {
  interface Window {
    FitrNative?: FitrNativeApi;
  }
}

function api(): FitrNativeApi | null {
  if (typeof window === "undefined") return null;
  return window.FitrNative ?? null;
}

/** True inside the Fitr Android app (bridge present). */
export function isNativeApp(): boolean {
  return api() !== null;
}

export function nativeVersion(): string | null {
  try {
    return api()?.version() ?? null;
  } catch {
    return null;
  }
}

/**
 * Speak a short phrase. Native TTS in the Android app; Web Speech API in browsers that have it;
 * otherwise silent. `interrupt` cuts off whatever is being said (use for time-critical prompts
 * like a live challenge).
 */
export function speak(text: string, interrupt = false): void {
  const native = api();
  if (native) {
    try {
      native.speak(text, interrupt);
    } catch {
      /* ignore */
    }
    return;
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    if (interrupt) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function stopSpeaking(): void {
  const native = api();
  try {
    if (native) native.stopSpeaking();
    else if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export type NotificationPermission = "granted" | "denied" | "default" | "unsupported";

export function notificationPermission(): NotificationPermission {
  const native = api();
  if (!native) return "unsupported";
  try {
    const v = native.notificationPermission();
    return v === "granted" || v === "denied" ? v : "default";
  } catch {
    return "unsupported";
  }
}

export function requestNotificationPermission(): void {
  try {
    api()?.requestNotificationPermission();
  } catch {
    /* ignore */
  }
}

export function scheduleReminders(plan: ReminderPlan): void {
  try {
    api()?.scheduleReminders(JSON.stringify(plan));
  } catch {
    /* ignore */
  }
}

export function cancelReminders(): void {
  try {
    api()?.cancelReminders();
  } catch {
    /* ignore */
  }
}

export function updateWidget(state: WidgetState): void {
  try {
    api()?.updateWidget(JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
