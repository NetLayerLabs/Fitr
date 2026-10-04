import { describe, expect, it } from "vitest";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_CODE,
  EXERCISE_LIST,
  EXERCISES,
  exerciseFromCode,
  exercisesByCategory,
} from "@/lib/exercises";
import { FORM_GUIDES, placementSteps } from "@/lib/formGuide";
import { EXERCISE_KINDS, isExerciseKind } from "@/lib/pose/types";

describe("exercise catalogue", () => {
  it("pins the on-chain codes (append-only, never reorder)", () => {
    expect(EXERCISE_KINDS).toEqual([
      "pushup",
      "squat",
      "plank",
      "lunge",
      "situp",
      "leg_raise",
      "glute_bridge",
      "wall_sit",
      "pike_pushup",
      "jump_squat",
      "pullup",
      "dip",
      "burpee",
      "mountain_climber",
      "jumping_jack",
      "high_knees",
    ]);
    EXERCISE_KINDS.forEach((kind, code) => {
      expect(EXERCISES[kind].kind).toBe(kind);
      expect(EXERCISES[kind].code).toBe(code);
      expect(EXERCISE_CODE[kind]).toBe(code);
      expect(exerciseFromCode(code)).toBe(kind);
    });
    expect(EXERCISE_LIST.map((e) => e.kind)).toEqual(EXERCISE_KINDS);
  });

  it("rejects unknown codes and kinds", () => {
    for (const code of [-1, 16, 1.5, Number.NaN, 255]) expect(exerciseFromCode(code)).toBeNull();
    expect(isExerciseKind("deadlift")).toBe(false);
    expect(isExerciseKind("toString")).toBe(false);
  });

  it("keeps the original three unchanged", () => {
    expect(EXERCISES.pushup).toMatchObject({ unit: "reps", defaultGoal: 20, minGoal: 10 });
    expect(EXERCISES.squat).toMatchObject({ unit: "reps", defaultGoal: 25, minGoal: 15 });
    expect(EXERCISES.plank).toMatchObject({ unit: "seconds", defaultGoal: 60, minGoal: 30 });
  });

  it("has sane goals, metadata and setup tips for every exercise", () => {
    for (const info of EXERCISE_LIST) {
      expect(info.minGoal).toBeGreaterThan(0);
      expect(info.defaultGoal).toBeGreaterThanOrEqual(info.minGoal);
      expect(Number.isInteger(info.defaultGoal) && Number.isInteger(info.minGoal)).toBe(true);
      expect(info.name.length).toBeGreaterThan(0);
      expect(info.tagline.length).toBeGreaterThan(0);
      expect(info.muscles.length).toBeGreaterThan(0);
      expect(info.setupTips.length).toBeGreaterThanOrEqual(3);
      const tips = info.setupTips.join(" ");
      if (info.camera === "front") expect(tips).toMatch(/front-facing/);
      else expect(tips).toMatch(/side-on/);
    }
    expect(EXERCISE_LIST.filter((e) => e.unit === "seconds").map((e) => e.kind)).toEqual(["plank", "wall_sit"]);
    expect(EXERCISE_LIST.filter((e) => e.camera === "front").map((e) => e.kind)).toEqual([
      "pullup",
      "jumping_jack",
      "high_knees",
    ]);
  });

  it("groups every exercise into exactly one category, in category order", () => {
    const groups = exercisesByCategory();
    expect(groups.map((g) => g.id)).toEqual(["push", "pull", "legs", "core", "cardio"]);
    expect(groups.map((g) => g.label)).toEqual(["Chest & Arms", "Back", "Legs & Glutes", "Core", "Cardio"]);
    expect(groups.flatMap((g) => g.exercises.map((e) => e.kind)).sort()).toEqual([...EXERCISE_KINDS].sort());
    for (const g of groups) expect(g.exercises.length).toBeGreaterThan(0);
    expect(EXERCISE_CATEGORIES.every((c) => c.description.length > 0)).toBe(true);
  });

  it("has a form guide with three cues for every exercise", () => {
    for (const kind of EXERCISE_KINDS) {
      const guide = FORM_GUIDES[kind];
      expect(guide.cues).toHaveLength(3);
      expect(guide.title.length).toBeGreaterThan(0);
      const steps = placementSteps(kind);
      expect(steps.length).toBeGreaterThanOrEqual(4);
      expect(steps[1]).toContain(guide.placement.distance);
      if (EXERCISES[kind].camera === "front") expect(steps[2]).toMatch(/Face the phone/);
      else expect(steps[2]).toMatch(/side-on/);
      if (guide.placement.layout === "floor") expect(steps[0]).toMatch(/on the floor/);
    }
  });
});
