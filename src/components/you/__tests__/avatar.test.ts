// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AVATAR_STORAGE_KEY,
  MAX_NAME_LENGTH,
  NAME_STORAGE_KEY,
  cleanName,
  getAvatar,
  getName,
  resetAvatarCache,
  resetNameCache,
  setAvatar,
  setName,
  subscribeAvatar,
} from "../avatar";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

beforeEach(() => {
  window.localStorage.clear();
  resetAvatarCache();
  resetNameCache();
});

describe("profile photo", () => {
  it("is empty by default, persists, and can be removed", () => {
    expect(getAvatar()).toBeNull();
    setAvatar(PNG);
    resetAvatarCache();
    expect(getAvatar()).toBe(PNG);
    setAvatar(null);
    expect(window.localStorage.getItem(AVATAR_STORAGE_KEY)).toBeNull();
    expect(getAvatar()).toBeNull();
  });

  it("ignores anything that is not an image data URL", () => {
    window.localStorage.setItem(AVATAR_STORAGE_KEY, "javascript:alert(1)");
    expect(getAvatar()).toBeNull();
    expect(() => setAvatar("https://evil.example/x.png")).toThrow();
  });

  it("notifies subscribers", () => {
    const listener = vi.fn();
    const off = subscribeAvatar(listener);
    setAvatar(PNG);
    setName("Sam");
    expect(listener).toHaveBeenCalledTimes(2);
    off();
  });
});

describe("display name", () => {
  it("cleans whitespace, control characters and length", () => {
    expect(cleanName("  Big \n  Mike\u0007 ")).toBe("Big Mike");
    expect(cleanName("x".repeat(100))).toHaveLength(MAX_NAME_LENGTH);
  });

  it("persists and clears", () => {
    setName("  Jordan ");
    resetNameCache();
    expect(getName()).toBe("Jordan");
    setName("   ");
    expect(window.localStorage.getItem(NAME_STORAGE_KEY)).toBeNull();
    expect(getName()).toBe("");
  });
});
