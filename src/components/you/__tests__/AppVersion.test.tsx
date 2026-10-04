// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import AppVersion from "../AppVersion";

afterEach(() => {
  cleanup();
  delete window.FitrNative;
});

describe("AppVersion", () => {
  it("shows only the web version in a browser", () => {
    render(<AppVersion webVersion="0.3.0" />);
    expect(screen.getByText("Fitr web 0.3.0")).toBeTruthy();
  });

  it("shows the Android app version and build inside the app", () => {
    window.FitrNative = { version: () => "1.1.0+3" } as unknown as NonNullable<typeof window.FitrNative>;
    render(<AppVersion webVersion="0.3.0" />);
    expect(screen.getByText("Fitr 1.1.0 (build 3) · web 0.3.0")).toBeTruthy();
  });
});
