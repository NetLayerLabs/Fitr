import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRAND_ACCENT, BRAND_BACKGROUND } from "@/components/pwa/iconSet";

/**
 * WCAG contrast audit of the design tokens in src/app/globals.css. Resolves var() chains in the
 * :root block, so changing a primitive re-runs the whole audit.
 */
const CSS = readFileSync(fileURLToPath(new URL("../../../app/globals.css", import.meta.url)), "utf8");

function rootTokens(): Map<string, string> {
  const block = CSS.slice(CSS.indexOf(":root {"), CSS.indexOf("\n}", CSS.indexOf(":root {")));
  const map = new Map<string, string>();
  for (const m of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) map.set(m[1], m[2].trim());
  return map;
}

const TOKENS = rootTokens();

function resolve(name: string, depth = 0): string {
  const raw = TOKENS.get(name);
  if (raw === undefined) throw new Error(`missing token ${name}`);
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(raw);
  if (ref && depth < 10) return resolve(ref[1], depth + 1);
  return raw;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(resolve(a)), luminance(resolve(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ["--bg", "--surface", "--surface-elevated", "--surface-strong"];

describe("design tokens", () => {
  it("resolves every semantic color to a 6-digit hex", () => {
    for (const name of ["--bg", ...SURFACES, "--text", "--text-muted", "--text-subtle", "--accent", "--on-accent"]) {
      expect(resolve(name)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("is lime on near-black", () => {
    expect(resolve("--accent").toLowerCase()).toBe("#c6f432");
    expect(luminance(resolve("--bg"))).toBeLessThan(0.01);
  });

  it.each(SURFACES)("text tokens meet AA on %s", (surface) => {
    expect(contrast("--text", surface)).toBeGreaterThanOrEqual(7);
    expect(contrast("--text-muted", surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("--text-subtle", surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("--accent", surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("--warning", surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("--danger", surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("ink on lime meets AAA, muted ink meets AA", () => {
    expect(contrast("--on-accent", "--accent")).toBeGreaterThanOrEqual(7);
    expect(contrast("--on-accent-muted", "--accent")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("--on-danger", "--danger")).toBeGreaterThanOrEqual(4.5);
  });

  it("control borders meet the 3:1 non-text minimum", () => {
    expect(contrast("--border-strong", "--bg")).toBeGreaterThanOrEqual(3);
    expect(contrast("--border-strong", "--surface-elevated")).toBeGreaterThanOrEqual(3);
  });

  it("keeps the PWA icon colors in sync with the tokens", () => {
    expect(BRAND_ACCENT.toLowerCase()).toBe(resolve("--accent").toLowerCase());
    expect(BRAND_BACKGROUND.toLowerCase()).toBe(resolve("--bg").toLowerCase());
  });

  it("defines the display type scale", () => {
    for (const name of ["--font-display", "--text-4xl", "--text-5xl", "--text-6xl", "--text-7xl", "--tracking-display"]) {
      expect(TOKENS.has(name)).toBe(true);
    }
  });
});
