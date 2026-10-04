"use client";

/**
 * Clock-in reminder preference + Android notification permission, for a settings row
 * ("Reminders") and for NativeSync. Only meaningful inside the Fitr Android app
 * (isNativeApp()); in a browser `available` is false and everything is a no-op.
 *
 * The Android shell fires `window` event "fitrnative" with
 * detail { type: "notificationPermission", value: "granted" | "denied" | "default" } after the
 * system permission dialog closes; the permission is also re-read whenever the page becomes
 * visible again (the user may have changed it in system settings).
 */
import { useCallback, useSyncExternalStore } from "react";
import {
  isNativeApp,
  notificationPermission,
  requestNotificationPermission,
  type NotificationPermission,
} from "@/lib/native/bridge";

export const NATIVE_EVENT = "fitrnative";
const ENABLED_KEY = "fitr.reminders.enabled";
const ASKED_KEY = "fitr.reminders.asked";

const listeners = new Set<() => void>();
let enabledCache: boolean | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function readEnabled(): boolean {
  if (enabledCache !== null) return enabledCache;
  let v = true;
  try {
    v = window.localStorage.getItem(ENABLED_KEY) !== "0";
  } catch {
    /* storage blocked: default on */
  }
  enabledCache = v;
  return v;
}

/** Whether the user wants clock-in reminders (default on). */
export function remindersEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return readEnabled();
}

export function setRemindersEnabled(enabled: boolean): void {
  enabledCache = enabled;
  try {
    window.localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
  emit();
}

/** True once Fitr has shown the system notification prompt (never ask twice on its own). */
export function permissionAsked(): boolean {
  try {
    return window.localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Shows the system notification prompt and remembers that it did. */
export function askNotificationPermission(): void {
  try {
    window.localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* ignore */
  }
  requestNotificationPermission();
}

/** Test hook: forget cached state. */
export function resetNativeRemindersForTests(): void {
  enabledCache = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onChange = () => listener();
  const onVisible = () => {
    if (document.visibilityState === "visible") listener();
  };
  window.addEventListener(NATIVE_EVENT, onChange);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    listeners.delete(listener);
    window.removeEventListener(NATIVE_EVENT, onChange);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/** True inside the Fitr Android app; false during SSR/hydration and in browsers. */
export function useIsNativeApp(): boolean {
  return useSyncExternalStore(subscribe, isNativeApp, () => false);
}

export interface NativeReminders {
  /** Running inside the Android app (reminders can work at all). */
  available: boolean;
  /** User preference (default on). */
  enabled: boolean;
  /** Android notification permission ("unsupported" outside the app). */
  permission: NotificationPermission;
  /** Turn reminders on/off; turning on asks for the notification permission if needed. */
  setEnabled: (enabled: boolean) => void;
}

/** For a "Reminders" settings row. Call setEnabled from a user gesture (it may show a dialog). */
export function useNativeReminders(): NativeReminders {
  const available = useIsNativeApp();
  const enabled = useSyncExternalStore(subscribe, remindersEnabled, () => false);
  const permission = useSyncExternalStore(subscribe, notificationPermission, () => "unsupported" as const);
  const setEnabled = useCallback((next: boolean) => {
    setRemindersEnabled(next);
    if (next && notificationPermission() !== "granted") askNotificationPermission();
  }, []);
  return { available, enabled: available && enabled, permission, setEnabled };
}
