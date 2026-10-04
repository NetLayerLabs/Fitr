import { describe, expect, it } from "vitest";
import type { PoseFrame } from "@/lib/pose/types";
import {
  MIN_SCREEN_GRAVITY,
  TILTED_ENTER_DEG,
  TILTED_EXIT_DEG,
  gateFrameByOrientation,
  nextOrientationStatus,
  sceneRoll,
  type OrientationStatus,
} from "../orientation";

function roll(beta: number, gamma: number, screenAngle = 0): number {
  const r = sceneRoll(beta, gamma, screenAngle);
  if (!r) throw new Error("no reading");
  return r.rollDeg;
}

describe("sceneRoll", () => {
  it("is ~0 for a phone standing upright in portrait, also when leaning back or forward", () => {
    for (const beta of [90, 70, 110, 60]) {
      expect(Math.abs(roll(beta, 0)), `beta ${beta}`).toBeLessThan(1e-9);
    }
    expect(sceneRoll(90, 0, 0)?.inPlane).toBeCloseTo(1, 9);
  });

  it("is +-90 for a phone on its side and 180 upside down (portrait-locked screen)", () => {
    expect(roll(0, 90)).toBeCloseTo(90, 6); // right edge down
    expect(roll(0, -90)).toBeCloseTo(-90, 6); // left edge down
    expect(Math.abs(roll(-90, 0))).toBeCloseTo(180, 6); // top edge down
  });

  it("compensates when the screen (and camera frames) rotate with the phone", () => {
    // Device turned counter-clockwise (top to the left): left edge down, screen angle 90.
    expect(roll(0, -90, 90)).toBeCloseTo(0, 6);
    // Device turned clockwise (top to the right): right edge down, screen angle 270 (or -90).
    expect(roll(0, 90, 270)).toBeCloseTo(0, 6);
    expect(roll(0, 90, -90)).toBeCloseTo(0, 6);
  });

  it("reports how vertical the screen is, and nothing for incomplete readings", () => {
    expect(sceneRoll(5, 0, 0)!.inPlane).toBeLessThan(MIN_SCREEN_GRAVITY); // lying flat
    expect(sceneRoll(null, 0, 0)).toBeNull();
    expect(sceneRoll(90, undefined, 0)).toBeNull();
    expect(sceneRoll(Number.NaN, 0, 0)).toBeNull();
    expect(roll(90, 0, Number.NaN)).toBeCloseTo(0, 9);
  });
});

describe("nextOrientationStatus", () => {
  const at = (deg: number) => ({ rollDeg: deg, inPlane: 1 });

  it("gates with hysteresis", () => {
    let status: OrientationStatus = "unknown";
    const seen: OrientationStatus[] = [];
    for (const deg of [0, 20, TILTED_ENTER_DEG - 1, TILTED_ENTER_DEG + 1, 35, TILTED_EXIT_DEG + 1, TILTED_EXIT_DEG - 1, -50, 180]) {
      status = nextOrientationStatus(status, at(deg));
      seen.push(status);
    }
    expect(seen).toEqual(["upright", "upright", "upright", "tilted", "tilted", "tilted", "upright", "tilted", "tilted"]);
  });

  it("is unknown without a reading or with the phone lying flat", () => {
    expect(nextOrientationStatus("tilted", null)).toBe("unknown");
    expect(nextOrientationStatus("upright", { rollDeg: 90, inPlane: 0.2 })).toBe("unknown");
  });
});

describe("gateFrameByOrientation", () => {
  const frame: PoseFrame = {
    timestampMs: 5,
    landmarks: [{ x: 0.5, y: 0.5, z: 0, visibility: 1 }],
    worldLandmarks: [{ x: 0, y: 0, z: 0, visibility: 1 }],
    imageWidth: 640,
    imageHeight: 480,
  };

  it("drops the pose only while the phone is known to be tilted", () => {
    expect(gateFrameByOrientation(frame, "upright")).toBe(frame);
    expect(gateFrameByOrientation(frame, "unknown")).toBe(frame);
    expect(gateFrameByOrientation(frame, "tilted")).toEqual({ timestampMs: 5, landmarks: [], imageWidth: 640, imageHeight: 480 });
    // Never mutates the input.
    expect(frame.landmarks).toHaveLength(1);
  });
});
