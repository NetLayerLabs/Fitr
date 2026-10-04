// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GUIDE_PREFS,
  GUIDE_PREFS_STORAGE_KEY,
  getGuidePrefs,
  getServerGuidePrefs,
  resetGuidePrefsCache,
  setGuideHidden,
  subscribeGuidePrefs,
} from "../guidePrefs";

beforeEach(() => {
  window.localStorage.clear();
  resetGuidePrefsCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("guide prefs", () => {
  it("defaults to showing every guide", () => {
    expect(getGuidePrefs()).toEqual({ ...DEFAULT_GUIDE_PREFS, pushup: false, squat: false, plank: false });
    expect(getServerGuidePrefs()).toBe(DEFAULT_GUIDE_PREFS);
  });

  it("hides one exercise without touching the others, and persists", () => {
    setGuideHidden("pushup", true);
    expect(getGuidePrefs()).toEqual({ ...DEFAULT_GUIDE_PREFS, pushup: true, squat: false, plank: false });
    resetGuidePrefsCache();
    expect(getGuidePrefs().pushup).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(GUIDE_PREFS_STORAGE_KEY)!)).toEqual({
      hidden: { ...DEFAULT_GUIDE_PREFS, pushup: true },
    });
  });

  it("can show a hidden guide again", () => {
    setGuideHidden("plank", true);
    setGuideHidden("plank", false);
    expect(getGuidePrefs().plank).toBe(false);
  });

  it("keeps snapshot identity stable until data changes", () => {
    const a = getGuidePrefs();
    expect(getGuidePrefs()).toBe(a);
    setGuideHidden("squat", false); // no change
    expect(getGuidePrefs()).toBe(a);
    setGuideHidden("squat", true);
    expect(getGuidePrefs()).not.toBe(a);
  });

  it("notifies subscribers, including on cross-tab storage events", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeGuidePrefs(listener);
    setGuideHidden("pushup", true);
    expect(listener).toHaveBeenCalledTimes(1);

    window.localStorage.setItem(GUIDE_PREFS_STORAGE_KEY, JSON.stringify({ hidden: { squat: true } }));
    window.dispatchEvent(new StorageEvent("storage", { key: GUIDE_PREFS_STORAGE_KEY }));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getGuidePrefs()).toEqual({ ...DEFAULT_GUIDE_PREFS, pushup: false, squat: true, plank: false });
    unsubscribe();
  });

  it("treats corrupt or foreign data as defaults", () => {
    window.localStorage.setItem(GUIDE_PREFS_STORAGE_KEY, "{not json");
    expect(getGuidePrefs()).toBe(DEFAULT_GUIDE_PREFS);
    resetGuidePrefsCache();
    window.localStorage.setItem(GUIDE_PREFS_STORAGE_KEY, JSON.stringify({ hidden: { pushup: "yes", bogus: true } }));
    expect(getGuidePrefs()).toEqual({ ...DEFAULT_GUIDE_PREFS, pushup: false, squat: false, plank: false });
  });

  it("keeps working in memory when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    setGuideHidden("squat", true);
    expect(getGuidePrefs().squat).toBe(true);
  });
});
