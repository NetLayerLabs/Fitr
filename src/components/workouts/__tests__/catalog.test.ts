import { describe, expect, it } from "vitest";
import { EXERCISES, EXERCISE_CATEGORIES, EXERCISE_LIST } from "@/lib/exercises";
import {
  catalogQuery,
  categoryCounts,
  equipmentBadge,
  filterExercises,
  parseCategory,
  parseNoEquipment,
  quickStartKinds,
  workoutAccessibleName,
} from "../catalog";

describe("catalog helpers", () => {
  it("counts 16 workouts split across the five categories", () => {
    const counts = categoryCounts(false);
    expect(counts.all).toBe(16);
    expect(counts).toEqual({ all: 16, push: 3, pull: 1, legs: 5, core: 4, cardio: 3 });
    const sum = EXERCISE_CATEGORIES.reduce((n, c) => n + counts[c.id], 0);
    expect(sum).toBe(EXERCISE_LIST.length);
  });

  it("no-equipment counts drop pull-ups, dips and wall sit", () => {
    expect(categoryCounts(true)).toEqual({ all: 13, push: 2, pull: 0, legs: 4, core: 4, cardio: 3 });
    expect(filterExercises({ category: "all", noEquipment: true }).map((i) => i.kind)).not.toContain("pullup");
  });

  it("filters by category in code order", () => {
    expect(filterExercises({ category: "push", noEquipment: false }).map((i) => i.kind)).toEqual([
      "pushup",
      "pike_pushup",
      "dip",
    ]);
    expect(filterExercises({ category: "all", noEquipment: false })).toHaveLength(16);
  });

  it("parses and serialises the URL filter, ignoring junk", () => {
    expect(parseCategory("legs")).toBe("legs");
    expect(parseCategory("toString")).toBe("all");
    expect(parseCategory(null)).toBe("all");
    expect(parseNoEquipment("none")).toBe(true);
    expect(parseNoEquipment("yes")).toBe(false);
    expect(catalogQuery({ category: "all", noEquipment: false })).toBe("");
    expect(catalogQuery({ category: "legs", noEquipment: true })).toBe("?c=legs&eq=none");
  });

  it("badges equipment", () => {
    expect(equipmentBadge("bar")).toBe("Bar");
    expect(equipmentBadge("chair")).toBe("Chair");
    expect(equipmentBadge("wall")).toBe("Wall");
    expect(equipmentBadge("none")).toBeNull();
  });

  it("builds full accessible names", () => {
    expect(workoutAccessibleName(EXERCISES.pullup)).toBe("Pull-ups, 8 reps, needs a bar, front camera, advanced");
    expect(workoutAccessibleName(EXERCISES.wall_sit)).toBe("Wall sit, 1 minute, needs a wall, beginner");
    expect(workoutAccessibleName(EXERCISES.pushup)).toBe("Push-ups, 20 reps, beginner");
  });

  it("quick start: falls back to push-ups, squats, plank", () => {
    expect(quickStartKinds([])).toEqual(["pushup", "squat", "plank"]);
  });

  it("quick start: newest distinct exercises first, topped up from the fallback", () => {
    expect(
      quickStartKinds([
        { exercise: "squat", startedAt: 100 },
        { exercise: "pullup", startedAt: 300 },
        { exercise: "pullup", startedAt: 250 },
      ]),
    ).toEqual(["pullup", "squat", "pushup"]);
    expect(
      quickStartKinds([
        { exercise: "dip", startedAt: 1 },
        { exercise: "lunge", startedAt: 2 },
        { exercise: "burpee", startedAt: 3 },
        { exercise: "situp", startedAt: 4 },
      ]),
    ).toEqual(["situp", "burpee", "lunge"]);
  });
});
