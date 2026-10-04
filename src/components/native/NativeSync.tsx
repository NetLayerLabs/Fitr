"use client";

/**
 * Keeps the Android app's native surfaces in step with the web app: the "Fitr — Today"
 * home-screen widget and the clock-in reminder notifications. Renders nothing, and does nothing
 * (not even the vault/streak hooks) outside the Fitr Android app.
 *
 * Must be mounted inside <WalletProviders> (useTodayCommitment reads the selected wallet).
 */
import { useEffect, useRef } from "react";
import { useTodayCommitment } from "@/hooks/useTodayCommitment";
import { useNow, useSessions } from "@/hooks/useSessions";
import { cancelReminders, notificationPermission, scheduleReminders, updateWidget } from "@/lib/native/bridge";
import { computeStreak } from "@/lib/storage/streak";
import { reminderPlanFor, widgetStateFor } from "./nativePlan";
import { askNotificationPermission, permissionAsked, useIsNativeApp, useNativeReminders } from "./useNativeReminders";

export default function NativeSync() {
  return useIsNativeApp() ? <NativeSyncActive /> : null;
}

function NativeSyncActive() {
  const commitment = useTodayCommitment();
  const sessions = useSessions();
  const nowMs = useNow();
  const { enabled } = useNativeReminders();

  const lastWidget = useRef<string | null>(null);
  const lastPlan = useRef<string | null>(null);
  const prevState = useRef<string | null>(null);

  const streak = nowMs > 0 ? computeStreak(sessions, nowMs).current : null;

  // Widget: push only real changes (the clock ticks every 30 s; the widget counts down itself).
  useEffect(() => {
    if (streak === null) return;
    const state = widgetStateFor(commitment, streak);
    if (!state) return;
    const json = JSON.stringify(state);
    if (json === lastWidget.current) return;
    lastWidget.current = json;
    updateWidget(state);
  }, [commitment, streak]);

  // Reminders: schedule for an open commitment, cancel otherwise (verified, none, disabled...).
  useEffect(() => {
    if (nowMs <= 0 || commitment.state === "loading") return;
    const plan = enabled ? reminderPlanFor(commitment, nowMs) : null;
    const json = plan ? JSON.stringify(plan) : "none";
    if (json === lastPlan.current) return;
    lastPlan.current = json;
    if (plan) scheduleReminders(plan);
    else cancelReminders();
  }, [commitment, enabled, nowMs]);

  // Ask for the notification permission once, right after the first successful commit
  // (can_commit -> committed in this session), never on first load.
  useEffect(() => {
    const prev = prevState.current;
    const next = commitment.state;
    if (next === "loading") return;
    prevState.current = next;
    if (prev !== "can_commit" || (next !== "committed" && next !== "verifying")) return;
    if (!enabled || permissionAsked() || notificationPermission() !== "default") return;
    askNotificationPermission();
  }, [commitment.state, enabled]);

  return null;
}
