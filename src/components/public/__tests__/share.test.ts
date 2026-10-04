import { describe, expect, it, vi } from "vitest";
import { shareLink } from "../share";

const data = { url: "https://fitr.day/s/x/1", title: "t", text: "x" };

describe("shareLink", () => {
  it("uses the native share sheet when available", async () => {
    const share = vi.fn(async () => {});
    expect(await shareLink(data, { share })).toBe("shared");
    expect(share).toHaveBeenCalledWith(data);
  });

  it("treats a dismissed sheet as cancelled", async () => {
    const err = Object.assign(new Error("dismissed"), { name: "AbortError" });
    expect(await shareLink(data, { share: async () => Promise.reject(err) })).toBe("cancelled");
  });

  it("falls back to copying the link", async () => {
    const writeText = vi.fn(async () => {});
    expect(await shareLink(data, { clipboard: { writeText } })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(data.url);
    const notAllowed = Object.assign(new Error("no"), { name: "NotAllowedError" });
    expect(await shareLink(data, { share: async () => Promise.reject(notAllowed), clipboard: { writeText } })).toBe("copied");
  });

  it("fails without any share mechanism", async () => {
    expect(await shareLink(data, undefined)).toBe("failed");
  });
});
