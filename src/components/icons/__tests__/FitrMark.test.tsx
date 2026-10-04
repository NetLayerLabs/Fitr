// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import OfflinePage from "@/app/offline/page";
import { ARC_END, ARC_PATH, F_BARS, MARK_VIEWBOX } from "@/components/pwa/markGeometry";
import { FitrMark } from "../Icons";

afterEach(() => {
  cleanup();
});

describe("FitrMark", () => {
  it("draws the app icon's F-in-a-ring artwork", () => {
    // The ring arc the icons have always used (290 degrees from 12 o'clock, r = 40).
    expect(ARC_PATH).toBe("M 50 10 A 40 40 0 1 1 12.412 36.319");
    const { container } = render(<FitrMark size={36} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe(MARK_VIEWBOX);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelector("path")?.getAttribute("d")).toBe(ARC_PATH);
    expect(svg.querySelectorAll("rect")).toHaveLength(F_BARS.length);
    // Knob + track at normal sizes.
    expect(svg.querySelectorAll("circle")).toHaveLength(2);
    expect(svg.querySelector(`circle[cx="${ARC_END.x}"]`)).toBeTruthy();
  });

  it("uses the favicon treatment when tiny", () => {
    const { container } = render(<FitrMark size={22} />);
    expect(container.querySelectorAll("circle")).toHaveLength(0);
    expect(container.querySelector("path")?.getAttribute("d")).toBe(ARC_PATH);
  });

  it("matches the offline page's mark", () => {
    const { container } = render(<OfflinePage />);
    expect(container.querySelector("svg path")?.getAttribute("d")).toBe(ARC_PATH);
    expect(container.querySelectorAll("svg rect")).toHaveLength(F_BARS.length);
  });
});
