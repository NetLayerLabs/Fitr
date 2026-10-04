// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SkrAmount, SkrText } from "../SkrAmount";

afterEach(cleanup);

describe("SKR amounts", () => {
  it("shows the number with the token logo and still reads as 'N SKR'", () => {
    const { container } = render(<SkrAmount value="15" />);
    expect(container.querySelector('img[src="/brand/skr-token.png"]')).toBeTruthy();
    expect(container.textContent).toBe("15 SKR");
  });

  it("replaces every amount in a sentence and leaves plain mentions alone", () => {
    const { container } = render(<SkrText text="Your 10 SKR stake plus 2.5 SKR. Stake SKR daily." />);
    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(container.textContent).toBe("Your 10 SKR stake plus 2.5 SKR. Stake SKR daily.");
  });

  it("tags test tokens", () => {
    const { container } = render(<SkrText text="Commit 5 tSKR" />);
    expect(container.textContent).toContain("tSKR");
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });
});
