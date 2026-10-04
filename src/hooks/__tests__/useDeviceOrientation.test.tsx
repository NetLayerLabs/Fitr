// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestDeviceOrientationAccess, useDeviceOrientation } from "../useDeviceOrientation";

function tilt(beta: number, gamma: number) {
  const event = new Event("deviceorientation") as Event & { beta: number; gamma: number; alpha: number };
  Object.assign(event, { alpha: 0, beta, gamma });
  act(() => {
    window.dispatchEvent(event);
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useDeviceOrientation", () => {
  it("is unknown until a reading arrives, then follows the phone", () => {
    const { result } = renderHook(() => useDeviceOrientation(true));
    expect(result.current).toBe("unknown");
    tilt(88, 3);
    expect(result.current).toBe("upright");
    tilt(0, 90); // lying on its side
    expect(result.current).toBe("tilted");
    tilt(-90, 0); // upside down
    expect(result.current).toBe("tilted");
    tilt(90, 0);
    expect(result.current).toBe("upright");
  });

  it("ignores readings while disabled and starts from unknown again", () => {
    const { result, rerender } = renderHook(({ on }) => useDeviceOrientation(on), { initialProps: { on: false } });
    tilt(0, 90);
    expect(result.current).toBe("unknown");
    rerender({ on: true });
    expect(result.current).toBe("unknown");
    tilt(0, 90);
    expect(result.current).toBe("tilted");
    rerender({ on: false });
    expect(result.current).toBe("unknown");
    rerender({ on: true });
    expect(result.current).toBe("unknown");
  });

  it("uses the screen angle, so a phone turned with an auto-rotating screen is upright", () => {
    vi.stubGlobal("screen", { orientation: { angle: 90 } });
    const { result } = renderHook(() => useDeviceOrientation(true));
    tilt(0, -90);
    expect(result.current).toBe("upright");
  });
});

describe("requestDeviceOrientationAccess", () => {
  it("asks for permission where the browser requires it (iOS) and ignores a denial", async () => {
    const requestPermission = vi.fn(() => Promise.reject(new Error("denied")));
    vi.stubGlobal("DeviceOrientationEvent", Object.assign(function DeviceOrientationEvent() {}, { requestPermission }));
    requestDeviceOrientationAccess();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });

  it("is a no-op elsewhere", () => {
    vi.stubGlobal("DeviceOrientationEvent", function DeviceOrientationEvent() {});
    expect(() => requestDeviceOrientationAccess()).not.toThrow();
    vi.stubGlobal("DeviceOrientationEvent", undefined);
    expect(() => requestDeviceOrientationAccess()).not.toThrow();
  });
});
