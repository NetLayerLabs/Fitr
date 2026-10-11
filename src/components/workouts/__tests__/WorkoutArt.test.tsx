// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXERCISES } from "@/lib/exercises";
import { EXERCISE_KINDS } from "@/lib/pose/types";

let artEnabled = true;
vi.mock("@/lib/exerciseArt", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/exerciseArt")>();
  return { ...real, exerciseArt: (...args: Parameters<typeof real.exerciseArt>) => (artEnabled ? real.exerciseArt(...args) : null) };
});

import { exerciseArt } from "@/lib/exerciseArt";
import WorkoutCard from "../WorkoutCard";
import WorkoutCatalog from "../WorkoutCatalog";

afterEach(() => {
  cleanup();
  artEnabled = true;
});

describe("exerciseArt", () => {
  it("has a square photo set for every exercise and none for a demonstrator without photos", () => {
    for (const kind of EXERCISE_KINDS) {
      const art = exerciseArt(kind)!;
      expect(art.src).toBe(`/art/exercises/${kind}-man.jpg`);
      expect(art.thumb).toBe(`/art/exercises/${kind}-man-sm.jpg`);
      expect(art.alt).toMatch(/^Athlete /);
      expect(["floor", "full"]).toContain(art.framing);
    }
    expect(exerciseArt("pushup", "woman")).toBeNull();
  });
});

describe("WorkoutCard photo", () => {
  it("shows a decorative, lazy, sized photo (the link label names the workout)", () => {
    render(<WorkoutCard info={EXERCISES.pullup} />);
    const img = document.querySelector("img")!;
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("width")).toBe("960");
    expect(img.getAttribute("height")).toBe("960");
    expect(img.getAttribute("srcset")).toContain("pullup-man.jpg 960w");
  });

  it("falls back to the exercise icon when there is no photo", () => {
    artEnabled = false;
    render(<WorkoutCard info={EXERCISES.pullup} />);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector('[data-art="icon"] svg')).not.toBeNull();
  });

  it("loads only the first catalogue photo eagerly (16 workouts + 4 locked Fitr Pro cards)", () => {
    render(<WorkoutCatalog filter={{ category: "all", noEquipment: false }} />);
    const imgs = [...document.querySelectorAll("img")];
    expect(imgs).toHaveLength(20);
    expect(imgs.filter((i) => i.getAttribute("loading") === "eager")).toEqual([imgs[0]]);
  });
});
