// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EXERCISE_KINDS } from "@/lib/pose/types";
import { ExerciseIcon } from "../Icons";

afterEach(() => {
  cleanup();
});

describe("ExerciseIcon", () => {
  it("draws a distinct pictogram for every exercise", () => {
    const drawings = new Set<string>();
    for (const kind of EXERCISE_KINDS) {
      const { container, unmount } = render(<ExerciseIcon kind={kind} />);
      const svg = container.querySelector("svg")!;
      expect(svg).not.toBeNull();
      expect(svg.children.length).toBeGreaterThan(1);
      drawings.add(svg.innerHTML);
      unmount();
    }
    expect(drawings.size).toBe(EXERCISE_KINDS.length);
  });
});
