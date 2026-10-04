import { describe, expect, it } from "vitest";
import { OneEuroFilter } from "@/lib/pose/filters";
import { DEFAULT_ANGLE_FILTER } from "@/lib/pose/engine";
import { mulberry32 } from "@/lib/pose/testing/synthetic";

const std = (xs: number[]) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
};

describe("OneEuroFilter", () => {
  it("passes the first sample through and holds a constant signal", () => {
    const f = new OneEuroFilter(DEFAULT_ANGLE_FILTER);
    expect(f.value).toBeNull();
    expect(f.filter(123, 0)).toBe(123);
    for (let i = 1; i < 60; i++) expect(f.filter(123, i * 33)).toBeCloseTo(123, 10);
  });

  it("suppresses +/-4 degree frame noise at 30 fps", () => {
    const rng = mulberry32(42);
    const f = new OneEuroFilter(DEFAULT_ANGLE_FILTER);
    const raw: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < 300; i++) {
      const x = 170 + (rng() * 2 - 1) * 4;
      raw.push(x);
      out.push(f.filter(x, Math.round((i * 1000) / 30)));
    }
    const settled = out.slice(30);
    expect(std(settled)).toBeLessThan(std(raw) / 2);
    for (const v of settled) expect(Math.abs(v - 170)).toBeLessThan(3);
  });

  it("tracks a fast movement with little lag (a 1 s rep still reaches the bottom)", () => {
    const f = new OneEuroFilter(DEFAULT_ANGLE_FILTER);
    let min = Infinity;
    for (let t = 0; t <= 2000; t += 33) {
      // 170 -> 70 -> 170 over 1 s starting at t = 500, cosine eased.
      const p = Math.min(Math.max((t - 500) / 1000, 0), 1);
      const x = 120 + 50 * Math.cos(2 * Math.PI * p);
      min = Math.min(min, f.filter(x, t));
    }
    expect(min).toBeLessThan(80);
  });

  it("is time-based: 15 fps and 30 fps sampling of the same motion agree", () => {
    const signal = (t: number) => 120 + 50 * Math.cos((2 * Math.PI * t) / 1500);
    const f30 = new OneEuroFilter(DEFAULT_ANGLE_FILTER);
    const f15 = new OneEuroFilter(DEFAULT_ANGLE_FILTER);
    const at30 = new Map<number, number>();
    for (let i = 0; i <= 90; i++) {
      const t = Math.round((i * 1000) / 30);
      at30.set(t, f30.filter(signal(t), t));
    }
    let compared = 0;
    for (let i = 0; i <= 45; i++) {
      const t = Math.round((i * 1000) / 15);
      const v15 = f15.filter(signal(t), t);
      const v30 = at30.get(t);
      if (v30 !== undefined && t >= 500) {
        expect(Math.abs(v15 - v30)).toBeLessThan(4);
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(10);
  });

  it("ignores non-finite samples and non-increasing timestamps", () => {
    const f = new OneEuroFilter(DEFAULT_ANGLE_FILTER);
    expect(f.filter(Number.NaN, 0)).toBeNaN();
    expect(f.value).toBeNull();
    f.filter(100, 0);
    const v = f.filter(110, 33);
    expect(f.filter(Number.NaN, 66)).toBe(v);
    expect(f.filter(Infinity, 66)).toBe(v);
    expect(f.filter(500, 33)).toBe(v);
    expect(f.filter(500, 10)).toBe(v);
    expect(f.filter(500, Number.NaN)).toBe(v);
  });

  it("reset() forgets history", () => {
    const f = new OneEuroFilter(DEFAULT_ANGLE_FILTER);
    f.filter(10, 0);
    f.filter(20, 33);
    f.reset();
    expect(f.value).toBeNull();
    expect(f.filter(90, 10)).toBe(90);
  });

  it("sanitises invalid parameters instead of producing NaN", () => {
    const f = new OneEuroFilter({ minCutoff: 0, beta: -1, dCutoff: Number.NaN });
    f.filter(0, 0);
    expect(Number.isFinite(f.filter(10, 33))).toBe(true);
  });
});
