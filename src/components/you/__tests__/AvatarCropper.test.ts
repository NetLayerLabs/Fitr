import { describe, expect, it } from "vitest";
import { clampFrame, coverScale, sourceRect, zoomFrame } from "../AvatarCropper";

const VIEW = 280;

describe("avatar crop math", () => {
  it("covers the frame with the short side at zoom 1", () => {
    expect(coverScale(1000, 500, VIEW)).toBeCloseTo(VIEW / 500);
  });

  it("never leaves empty space inside the frame", () => {
    const s = coverScale(1000, 500, VIEW);
    const f = clampFrame({ scale: s, x: 50, y: -20 }, 1000, 500, VIEW);
    expect(f.x).toBe(0);
    expect(f.y).toBe(0);
    const g = clampFrame({ scale: s, x: -10_000, y: 0 }, 1000, 500, VIEW);
    expect(g.x).toBeCloseTo(VIEW - 1000 * s);
  });

  it("zooms around the given point and maps to the right source square", () => {
    const s = coverScale(800, 800, VIEW); // square image fills the frame exactly
    const f = zoomFrame({ scale: s, x: 0, y: 0 }, s * 2, VIEW / 2, VIEW / 2, 800, 800, VIEW);
    const r = sourceRect(f, VIEW);
    expect(r.size).toBeCloseTo(400); // half the image at 2x
    expect(r.sx).toBeCloseTo(200); // centered
    expect(r.sy).toBeCloseTo(200);
  });
});
