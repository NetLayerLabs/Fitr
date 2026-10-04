// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetAvatarCache, resetNameCache, setAvatar } from "../avatar";
import ProfileHeader from "../ProfileHeader";

beforeEach(() => {
  window.localStorage.clear();
  resetAvatarCache();
  resetNameCache();
});

afterEach(cleanup);

describe("ProfileHeader", () => {
  it("shows only the photo and name (wallet details live in the Wallet section)", () => {
    render(<ProfileHeader />);
    expect(screen.getByRole("button", { name: "Add profile photo" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Add your name" })).toBeTruthy();
    expect(screen.queryByText(/your wallet/i)).toBeNull();
    expect(screen.queryByText("Not connected")).toBeNull();
  });

  it("edits the display name inline", () => {
    render(<ProfileHeader />);
    fireEvent.click(screen.getByRole("button", { name: "Add your name" }));
    const input = screen.getByRole("textbox", { name: "Your name" });
    fireEvent.change(input, { target: { value: "Coach K" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByRole("heading", { name: "Coach K" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit name" })).toBeTruthy();
  });

  it("offers change/remove once a photo exists", () => {
    setAvatar("data:image/png;base64,iVBORw0KGgo=");
    render(<ProfileHeader />);
    expect(screen.getByRole("button", { name: "Change profile photo" })).toBeTruthy();
  });

  it("rejects non-image files before opening the editor", () => {
    const { container } = render(<ProfileHeader />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } });
    expect(screen.getByText("Please choose an image file.")).toBeTruthy();
  });
});
