// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Hud from "../Hud";
import { INITIAL_HUD } from "../hudTracker";

afterEach(cleanup);

const base = { exercise: "pushup" as const, hud: INITIAL_HUD, fps: 30, delegate: "GPU" as const, fit: "cover" as const, onToggleFit: () => {}, onEnd: () => {} };

describe("Hud voice coach toggle", () => {
  it("is a pressed toggle that calls back", () => {
    const onToggleVoice = vi.fn();
    const { rerender } = render(<Hud {...base} voiceOn onToggleVoice={onToggleVoice} />);
    const btn = screen.getByRole("button", { name: "Voice coach" });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(btn);
    expect(onToggleVoice).toHaveBeenCalledTimes(1);
    rerender(<Hud {...base} voiceOn={false} onToggleVoice={onToggleVoice} />);
    expect(screen.getByRole("button", { name: "Voice coach" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("is hidden without a handler", () => {
    render(<Hud {...base} />);
    expect(screen.queryByRole("button", { name: "Voice coach" })).toBeNull();
  });
});
