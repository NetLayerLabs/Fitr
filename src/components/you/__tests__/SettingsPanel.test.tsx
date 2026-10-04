// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { remindersEnabled, resetNativeRemindersForTests } from "@/components/native/useNativeReminders";
import { getGuidePrefs, resetGuidePrefsCache, setGuideHidden } from "@/lib/storage/guidePrefs";
import { getPreferences, resetPreferencesCache } from "../preferences";
import SettingsPanel from "../SettingsPanel";

beforeEach(() => {
  localStorage.clear();
  resetPreferencesCache();
  resetGuidePrefsCache();
  resetNativeRemindersForTests();
});
afterEach(() => {
  cleanup();
  delete window.FitrNative;
});

function mockNative(permission: string) {
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

describe("SettingsPanel", () => {
  it("switches the default camera with radio chips", () => {
    render(<SettingsPanel />);
    const group = screen.getByRole("radiogroup", { name: "Default camera" });
    expect(group).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Front" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Back" }));
    expect(getPreferences().camera).toBe("environment");
    expect(screen.getByRole("radio", { name: "Back" }).getAttribute("aria-checked")).toBe("true");
  });

  it("toggles haptics with a switch", () => {
    render(<SettingsPanel />);
    const toggle = screen.getByRole("switch", { name: "Haptics" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(getPreferences().haptics).toBe(false);
  });

  it("toggles the voice coach with a switch (on by default)", () => {
    render(<SettingsPanel />);
    const toggle = screen.getByRole("switch", { name: "Voice coach" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(getPreferences().voiceCoach).toBe(false);
  });

  it("re-enables every hidden form guide", () => {
    act(() => {
      setGuideHidden("pushup", true);
      setGuideHidden("plank", true);
    });
    render(<SettingsPanel />);
    expect(screen.getByText("Hidden for 2 exercises.")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Show all form guides again" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(getGuidePrefs().pushup).toBe(false);
    expect(getGuidePrefs().plank).toBe(false);
    expect(screen.getByText(/Every exercise shows its form guide/)).toBeTruthy();
    expect(button.disabled).toBe(true);
  });

  it("shows clock-in reminders only inside the Android app", () => {
    render(<SettingsPanel />);
    expect(screen.queryByRole("switch", { name: "Clock-in reminders" })).toBeNull();
  });

  it("turns clock-in reminders off and on in the Android app", () => {
    const api = mockNative("granted");
    render(<SettingsPanel />);
    const toggle = screen.getByRole("switch", { name: "Clock-in reminders" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(remindersEnabled()).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(api.requestNotificationPermission).not.toHaveBeenCalled();
  });

  it("shows reminders as off without notification permission, and asks on tap", () => {
    const api = mockNative("denied");
    render(<SettingsPanel />);
    const toggle = screen.getByRole("switch", { name: "Clock-in reminders" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(/blocked for Fitr/)).toBeTruthy();
    fireEvent.click(toggle);
    expect(api.requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(remindersEnabled()).toBe(true);
  });
});
