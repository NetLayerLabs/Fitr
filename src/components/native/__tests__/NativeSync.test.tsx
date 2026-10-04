// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TodayCommitment } from "@/components/stake/plan";

let commitment: TodayCommitment = { state: "loading" };
vi.mock("@/hooks/useTodayCommitment", () => ({ useTodayCommitment: () => commitment }));

import NativeSync from "../NativeSync";
import { reminderPlanFor, widgetStateFor } from "../nativePlan";
import { NATIVE_EVENT, resetNativeRemindersForTests, useNativeReminders } from "../useNativeReminders";

const HOUR = 3_600_000;

function mockNative(permission = "default") {
  const api = {
    version: vi.fn(() => "1.1.0+3"),
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    notificationPermission: vi.fn(() => permission),
    requestNotificationPermission: vi.fn(),
    scheduleReminders: vi.fn(),
    cancelReminders: vi.fn(),
    updateWidget: vi.fn(),
  };
  window.FitrNative = api;
  return api;
}

beforeEach(() => {
  localStorage.clear();
  resetNativeRemindersForTests();
  commitment = { state: "loading" };
});

afterEach(() => {
  cleanup();
  delete window.FitrNative;
  vi.useRealTimers();
});

describe("nativePlan", () => {
  const now = Date.UTC(2026, 9, 4, 12);

  it("opens a crew stake's workout with ?crew=<id> from the widget and the reminders", () => {
    const c: TodayCommitment = {
      state: "committed",
      exercise: "squat",
      goalTarget: 30,
      amountLabel: "25 SKR",
      deadlineMs: now + 3 * HOUR,
      crewId: "42",
      crewName: "Morning crew",
    };
    expect(widgetStateFor(c, 1)?.openPath).toBe("/workout/squat?crew=42");
    expect(reminderPlanFor(c, now)?.openPath).toBe("/workout/squat?crew=42");
    expect(widgetStateFor({ ...c, crewId: "0" }, 1)?.openPath).toBe("/workout/squat");
  });

  it("maps a committed day to a workout widget and two reminders", () => {
    const c: TodayCommitment = {
      state: "committed",
      exercise: "pushup",
      goalTarget: 20,
      amountLabel: "50 SKR",
      deadlineMs: now + 5 * HOUR,
    };
    expect(widgetStateFor(c, 4)).toEqual({
      mode: "committed",
      streak: 4,
      goalLabel: "20 push-ups",
      stakeLabel: "50 SKR",
      deadlineMs: now + 5 * HOUR,
      openPath: "/workout/pushup",
    });
    expect(reminderPlanFor(c, now)).toEqual({
      deadlineMs: now + 5 * HOUR,
      offsetsMin: [120, 30],
      title: "{left} left: 20 push-ups",
      body: "Finish today or your 50 SKR stake goes to the people who showed up.",
      openPath: "/workout/pushup",
    });
  });

  it("labels holds in seconds", () => {
    const c: TodayCommitment = { state: "committed", exercise: "plank", goalTarget: 60, deadlineMs: now + HOUR };
    expect(widgetStateFor(c, 0)?.goalLabel).toBe("60 seconds of plank");
  });

  it("does not remind once verified, past the deadline, or with no commitment", () => {
    expect(reminderPlanFor({ state: "verified", exercise: "squat", goalTarget: 30 }, now)).toBeNull();
    expect(reminderPlanFor({ state: "committed", exercise: "squat", goalTarget: 30, deadlineMs: now - 1 }, now)).toBeNull();
    expect(reminderPlanFor({ state: "can_commit", deadlineMs: now + HOUR }, now)).toBeNull();
  });

  it("maps the other states to widget modes", () => {
    expect(widgetStateFor({ state: "loading" }, 1)).toBeNull();
    expect(widgetStateFor({ state: "can_commit", deadlineMs: now }, 2)).toMatchObject({ mode: "commit", openPath: "/commit" });
    expect(widgetStateFor({ state: "claimable", claimableLabel: "≈ 52.3 SKR" }, 2)).toMatchObject({
      mode: "claimable",
      stakeLabel: "≈ 52.3 SKR",
      openPath: "/",
    });
    expect(widgetStateFor({ state: "vault_unavailable" }, 3)).toEqual({
      mode: "none",
      streak: 3,
      goalLabel: "",
      stakeLabel: "",
      deadlineMs: 0,
      openPath: "/",
    });
  });
});

describe("NativeSync", () => {
  it("does nothing in a normal browser", () => {
    commitment = { state: "can_commit" };
    const { container } = render(<NativeSync />);
    expect(container.innerHTML).toBe("");
  });

  it("pushes the widget and schedules reminders for an open commitment", () => {
    const api = mockNative();
    commitment = {
      state: "committed",
      exercise: "pushup",
      goalTarget: 20,
      amountLabel: "50 SKR",
      deadlineMs: Date.now() + 5 * HOUR,
    };
    render(<NativeSync />);
    expect(api.updateWidget).toHaveBeenCalledTimes(1);
    expect(JSON.parse(api.updateWidget.mock.calls[0][0])).toMatchObject({ mode: "committed", goalLabel: "20 push-ups" });
    expect(api.scheduleReminders).toHaveBeenCalledTimes(1);
    expect(JSON.parse(api.scheduleReminders.mock.calls[0][0])).toMatchObject({ offsetsMin: [120, 30] });
    expect(api.cancelReminders).not.toHaveBeenCalled();
    // Never asks for notifications on load.
    expect(api.requestNotificationPermission).not.toHaveBeenCalled();
  });

  it("cancels reminders once verified and does not re-send unchanged state", () => {
    const api = mockNative();
    commitment = { state: "verified", exercise: "squat", goalTarget: 30, amountLabel: "10 SKR" };
    const { rerender } = render(<NativeSync />);
    expect(api.cancelReminders).toHaveBeenCalledTimes(1);
    expect(api.scheduleReminders).not.toHaveBeenCalled();
    commitment = { ...commitment };
    rerender(<NativeSync />);
    expect(api.updateWidget).toHaveBeenCalledTimes(1);
    expect(api.cancelReminders).toHaveBeenCalledTimes(1);
  });

  it("skips everything while loading", () => {
    const api = mockNative();
    render(<NativeSync />);
    expect(api.updateWidget).not.toHaveBeenCalled();
    expect(api.scheduleReminders).not.toHaveBeenCalled();
    expect(api.cancelReminders).not.toHaveBeenCalled();
  });

  it("asks for notification permission once, after the first commit", () => {
    const api = mockNative("default");
    commitment = { state: "can_commit", deadlineMs: Date.now() + HOUR };
    const { rerender } = render(<NativeSync />);
    expect(api.requestNotificationPermission).not.toHaveBeenCalled();

    commitment = { state: "committed", exercise: "pushup", goalTarget: 20, amountLabel: "50 SKR", deadlineMs: Date.now() + 5 * HOUR };
    rerender(<NativeSync />);
    expect(api.requestNotificationPermission).toHaveBeenCalledTimes(1);

    // A later commit (e.g. tomorrow) does not ask again.
    commitment = { state: "can_commit", deadlineMs: Date.now() + HOUR };
    rerender(<NativeSync />);
    commitment = { state: "committed", exercise: "squat", goalTarget: 30, deadlineMs: Date.now() + 5 * HOUR };
    rerender(<NativeSync />);
    expect(api.requestNotificationPermission).toHaveBeenCalledTimes(1);
  });

  it("does not ask when the permission is already granted", () => {
    const api = mockNative("granted");
    commitment = { state: "can_commit" };
    const { rerender } = render(<NativeSync />);
    commitment = { state: "committed", exercise: "pushup", goalTarget: 20, deadlineMs: Date.now() + HOUR };
    rerender(<NativeSync />);
    expect(api.requestNotificationPermission).not.toHaveBeenCalled();
  });

  it("cancels reminders when the user turns them off", () => {
    const api = mockNative("granted");
    commitment = { state: "committed", exercise: "pushup", goalTarget: 20, deadlineMs: Date.now() + 5 * HOUR };
    let controls: ReturnType<typeof useNativeReminders> | null = null;
    function Settings() {
      controls = useNativeReminders();
      return null;
    }
    render(
      <>
        <NativeSync />
        <Settings />
      </>,
    );
    expect(controls!.available).toBe(true);
    expect(controls!.enabled).toBe(true);
    expect(api.scheduleReminders).toHaveBeenCalledTimes(1);
    act(() => controls!.setEnabled(false));
    expect(controls!.enabled).toBe(false);
    expect(api.cancelReminders).toHaveBeenCalledTimes(1);
  });

  it("re-reads the permission when the app reports a change", () => {
    let permission = "default";
    const api = mockNative();
    api.notificationPermission.mockImplementation(() => permission);
    let controls: ReturnType<typeof useNativeReminders> | null = null;
    function Settings() {
      controls = useNativeReminders();
      return null;
    }
    render(<Settings />);
    expect(controls!.permission).toBe("default");
    act(() => {
      permission = "granted";
      window.dispatchEvent(new CustomEvent(NATIVE_EVENT, { detail: { type: "notificationPermission", value: "granted" } }));
    });
    expect(controls!.permission).toBe("granted");
  });
});
