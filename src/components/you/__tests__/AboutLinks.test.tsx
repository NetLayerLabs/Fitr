// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import AboutLinks from "../AboutLinks";

afterEach(cleanup);

describe("AboutLinks", () => {
  it("links to the trust, privacy and credits pages and shows the version", () => {
    render(<AboutLinks version="1.2.3" />);
    expect(screen.getByRole("link", { name: /How verification works/ }).getAttribute("href")).toBe("/you/verification");
    expect(screen.getByRole("link", { name: /Privacy/ }).getAttribute("href")).toBe("/you/privacy");
    expect(screen.getByRole("link", { name: /Credits & licenses/ }).getAttribute("href")).toBe("/you/credits");
    expect(screen.getByText("Fitr version 1.2.3")).toBeTruthy();
  });
});
