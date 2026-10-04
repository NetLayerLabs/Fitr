// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGuidePrefs, resetGuidePrefsCache, setGuideHidden } from "@/lib/storage/guidePrefs";
import { getPreferences, resetPreferencesCache } from "../preferences";
import SettingsPanel from "../SettingsPanel";

beforeEach(() => {
  localStorage.clear();
  resetPreferencesCache();
  resetGuidePrefsCache();
});
afterEach(cleanup);

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
});
