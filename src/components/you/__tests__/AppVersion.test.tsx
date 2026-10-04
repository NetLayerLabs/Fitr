// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import AppVersion from "../AppVersion";

afterEach(() => {
  cleanup();
  delete window.FitrNative;
});

describe("AppVersion", () => {
  it("falls back to the web version outside the app", () => {
    render(<AppVersion webVersion="0.3.0" />);
    expect(screen.getByText("Fitr 0.3.0")).toBeTruthy();
  });

  it("shows just the Android app version inside the app", () => {
    window.FitrNative = { version: () => "1.1.0+3" } as unknown as NonNullable<typeof window.FitrNative>;
    render(<AppVersion webVersion="0.3.0" />);
    expect(screen.getByText("Fitr 1.1.0")).toBeTruthy();
  });
});
