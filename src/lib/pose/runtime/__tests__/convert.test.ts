import { describe, expect, it } from "vitest";
import { MonotonicClock, nextTimestamp, toPoseFrame, type LandmarkLike } from "../convert";

function pose(n: number, visibility?: number): LandmarkLike[] {
  return Array.from({ length: n }, (_, i) => ({ x: i / 100, y: 1 - i / 100, z: -i / 1000, visibility }));
}

describe("toPoseFrame", () => {
  it("copies the first pose into fresh plain objects", () => {
    const landmarks = [pose(33, 0.9)];
    const worldLandmarks = [pose(33, 0.8)];
    const frame = toPoseFrame({ landmarks, worldLandmarks }, 1234, 640, 480);

    expect(frame.timestampMs).toBe(1234);
    expect(frame.imageWidth).toBe(640);
    expect(frame.imageHeight).toBe(480);
    expect(frame.landmarks).toHaveLength(33);
    expect(frame.landmarks[5]).toEqual({ x: 0.05, y: 0.95, z: -0.005, visibility: 0.9 });
    expect(frame.worldLandmarks).toHaveLength(33);

    // Not the same objects: MediaPipe may reuse its buffers on the next call.
    expect(frame.landmarks).not.toBe(landmarks[0]);
    expect(frame.landmarks[0]).not.toBe(landmarks[0][0]);
    landmarks[0][0].x = 42;
    worldLandmarks[0][0].y = 42;
    expect(frame.landmarks[0].x).toBe(0);
    expect(frame.worldLandmarks?.[0].y).toBe(1);
  });

  it("returns an empty landmark list when no pose was detected", () => {
    for (const result of [{ landmarks: [], worldLandmarks: [] }, { landmarks: [[]] }, {}, null, undefined]) {
      const frame = toPoseFrame(result, 10, 320, 240);
      expect(frame.landmarks).toEqual([]);
      expect(frame.worldLandmarks).toBeUndefined();
      expect(frame).toMatchObject({ timestampMs: 10, imageWidth: 320, imageHeight: 240 });
    }
  });

  it("only reads the first pose", () => {
    const frame = toPoseFrame({ landmarks: [pose(33, 1), pose(33, 0.2)] }, 0, 1, 1);
    expect(frame.landmarks.every((lm) => lm.visibility === 1)).toBe(true);
  });

  it("defaults missing or non-finite visibility and z to 0", () => {
    const frame = toPoseFrame(
      { landmarks: [[{ x: 0.5, y: 0.5 }, { x: 0.1, y: 0.2, z: Number.NaN, visibility: Number.NaN }]] },
      0,
      1,
      1,
    );
    expect(frame.landmarks).toEqual([
      { x: 0.5, y: 0.5, z: 0, visibility: 0 },
      { x: 0.1, y: 0.2, z: 0, visibility: 0 },
    ]);
  });

  it("marks a landmark with non-finite x or y as not visible, whatever its visibility", () => {
    const frame = toPoseFrame(
      {
        landmarks: [
          [
            { x: Number.NaN, y: Number.NaN, z: 0.1, visibility: 0.98 },
            { x: 0.3, y: Number.POSITIVE_INFINITY, visibility: 0.9 },
            { x: 0.3, y: 0.4, visibility: 0.9 },
          ],
        ],
      },
      0,
      1,
      1,
    );
    expect(frame.landmarks).toEqual([
      { x: 0, y: 0, z: 0.1, visibility: 0 },
      { x: 0, y: 0, z: 0, visibility: 0 },
      { x: 0.3, y: 0.4, z: 0, visibility: 0.9 },
    ]);
  });

  it("omits worldLandmarks when absent", () => {
    const frame = toPoseFrame({ landmarks: [pose(33, 1)] }, 0, 1, 1);
    expect("worldLandmarks" in frame).toBe(false);
  });
});

describe("nextTimestamp", () => {
  it("passes through the first value, floored to whole ms", () => {
    expect(nextTimestamp(null, 1000.7)).toBe(1000);
  });

  it("is strictly increasing for equal, sub-ms and backwards clocks", () => {
    expect(nextTimestamp(1000, 1000)).toBe(1001);
    expect(nextTimestamp(1000, 1000.9)).toBe(1001);
    expect(nextTimestamp(1000, 990)).toBe(1001);
    expect(nextTimestamp(1000, 1033.4)).toBe(1033);
  });

  it("survives non-finite input", () => {
    expect(nextTimestamp(null, Number.NaN)).toBe(0);
    expect(nextTimestamp(5, Number.POSITIVE_INFINITY)).toBe(6);
    expect(nextTimestamp(Number.NaN, 12)).toBe(12);
  });
});

describe("MonotonicClock", () => {
  it("hands out strictly increasing integers", () => {
    const clock = new MonotonicClock();
    expect(clock.peek()).toBeNull();
    const inputs = [5.2, 5.2, 5.9, 3, 40, 40.1, 39, 100];
    const out = inputs.map((t) => clock.next(t));
    expect(out).toEqual([5, 6, 7, 8, 40, 41, 42, 100]);
    for (let i = 1; i < out.length; i++) expect(out[i]).toBeGreaterThan(out[i - 1]);
    expect(out.every(Number.isInteger)).toBe(true);
    expect(clock.peek()).toBe(100);
  });
});
