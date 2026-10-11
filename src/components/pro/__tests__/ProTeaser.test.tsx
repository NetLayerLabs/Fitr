// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ProCard from "../ProCard";
import ProWorkouts from "../ProWorkouts";

afterEach(cleanup);

describe("ProWorkouts", () => {
  it("shows four locked moves as buttons, never as workout links", () => {
    render(<ProWorkouts />);
    expect(screen.getByRole("heading", { name: /Fitr Pro/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Fitr Pro, coming soon/ })).toHaveLength(4);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("explains a locked move on tap, and hides the note on a second tap", () => {
    render(<ProWorkouts />);
    const pistol = screen.getByRole("button", { name: /Pistol squats/ });
    fireEvent.click(pistol);
    expect(pistol.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Pistol squats arrives with Fitr Pro. Coming soon.");
    fireEvent.click(pistol);
    expect(screen.getByRole("status").textContent).toBe("");
  });
});

describe("ProCard", () => {
  it("says Pro is coming, paid monthly in SKR with a crew discount, and offers nothing to buy", () => {
    render(<ProCard />);
    expect(screen.getByRole("heading", { name: "Fitr Pro" })).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();
    expect(screen.getByText("Paid monthly in SKR")).toBeTruthy();
    expect(screen.getByText("A lower price when your crew joins")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
