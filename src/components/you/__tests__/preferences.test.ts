// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  getPreferences,
  parsePreferences,
  resetPreferencesCache,
  setPreference,
  subscribePreferences,
} from "../preferences";

beforeEach(() => {
  localStorage.clear();
  resetPreferencesCache();
});
afterEach(() => vi.restoreAllMocks());

describe("preferences", () => {
  it("defaults to the front camera with haptics on", () => {
    expect(getPreferences()).toEqual({ camera: "user", haptics: true });
  });

  it("parses defensively", () => {
    expect(parsePreferences(null)).toBe(DEFAULT_PREFERENCES);
    expect(parsePreferences("{oops")).toBe(DEFAULT_PREFERENCES);
    expect(parsePreferences("[]")).toBe(DEFAULT_PREFERENCES);
    expect(parsePreferences('{"camera":"sideways","haptics":"yes"}')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{"camera":"environment","haptics":false}')).toEqual({ camera: "environment", haptics: false });
  });

  it("persists, notifies and keeps identity when unchanged", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePreferences(listener);
    const before = getPreferences();
    setPreference("camera", "user");
    expect(getPreferences()).toBe(before);
    expect(listener).not.toHaveBeenCalled();

    setPreference("camera", "environment");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "{}")).toEqual({ camera: "environment", haptics: true });
    resetPreferencesCache();
    expect(getPreferences().camera).toBe("environment");
    unsubscribe();
  });

  it("keeps the value in memory when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    setPreference("haptics", false);
    expect(getPreferences().haptics).toBe(false);
  });

  it("reloads on a storage event from another tab", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePreferences(listener);
    getPreferences();
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ camera: "environment", haptics: false }));
    window.dispatchEvent(new StorageEvent("storage", { key: PREFERENCES_STORAGE_KEY }));
    expect(listener).toHaveBeenCalled();
    expect(getPreferences()).toEqual({ camera: "environment", haptics: false });
    unsubscribe();
  });
});
