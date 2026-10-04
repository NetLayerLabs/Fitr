// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FORM_GUIDES, placementSteps } from "@/lib/formGuide";
import { DEFAULT_GUIDE_PREFS, getGuidePrefs, resetGuidePrefsCache } from "@/lib/storage/guidePrefs";
import FormGuide from "../FormGuide";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  window.localStorage.clear();
  resetGuidePrefsCache();
  // jsdom has no canvas; the demo must cope with a null context.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FormGuide", () => {
  it("shows the title, the three cues and the phone placement", () => {
    render(<FormGuide exercise="pushup" onContinue={() => {}} />);
    expect(screen.getByRole("heading", { level: 1, name: FORM_GUIDES.pushup.title })).toBeDefined();
    for (const cue of FORM_GUIDES.pushup.cues) expect(screen.getByText(cue)).toBeDefined();
    for (const step of placementSteps("pushup")) expect(screen.getByText(step)).toBeDefined();
    expect(screen.getByText("From above")).toBeDefined();
    expect(screen.getByText("What your phone sees")).toBeDefined();
    expect(screen.getByRole("img", { name: /demonstration of push-ups/i })).toBeDefined();
  });

  it("leads with the athlete photo, then labels the animated demo", () => {
    render(<FormGuide exercise="pullup" onContinue={() => {}} />);
    const photo = screen.getByRole("img", { name: /athlete at the top of a pull-up/i });
    expect(photo.getAttribute("loading")).toBe("eager");
    expect(photo.getAttribute("src")).toBe("/art/exercises/pullup-man-sm.jpg");
    expect(screen.getByRole("figure", { name: "Exact movement Fitr checks" })).toBeDefined();
  });

  it("hides the Man/Woman toggle until clips exist", () => {
    render(<FormGuide exercise="squat" onContinue={() => {}} />);
    expect(screen.queryByRole("radiogroup", { name: "Demonstrator" })).toBeNull();
  });

  it("continues without hiding the guide by default", () => {
    const onContinue = vi.fn();
    render(<FormGuide exercise="squat" onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(getGuidePrefs().squat).toBe(false);
  });

  it("saves 'don't show again' for this exercise only", () => {
    const onContinue = vi.fn();
    render(<FormGuide exercise="plank" onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /don't show this before plank again/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(getGuidePrefs()).toEqual({ ...DEFAULT_GUIDE_PREFS, plank: true });
  });
});
