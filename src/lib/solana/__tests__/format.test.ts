import { describe, expect, it } from "vitest";
import { formatSkr, formatSol, formatTokenAmount, parseTokenAmount, shortenAddress } from "../format";

describe("formatTokenAmount", () => {
  it("formats 6-decimal base units without floats", () => {
    expect(formatTokenAmount(0n, 6)).toBe("0");
    expect(formatTokenAmount(1n, 6)).toBe("0.000001");
    expect(formatTokenAmount(1_000_000n, 6)).toBe("1");
    expect(formatTokenAmount(1_234_500_000n, 6)).toBe("1,234.5");
    expect(formatTokenAmount(123_456_789_012_345_678n, 6)).toBe("123,456,789,012.345678");
  });

  it("truncates (never rounds up) to maxFractionDigits", () => {
    expect(formatTokenAmount(1_999_999n, 6, { maxFractionDigits: 2 })).toBe("1.99");
    expect(formatTokenAmount(999n, 6, { maxFractionDigits: 2 })).toBe("0");
  });

  it("pads to minFractionDigits and can drop grouping", () => {
    expect(formatTokenAmount(1_000_000_000n, 6, { minFractionDigits: 2 })).toBe("1,000.00");
    expect(formatTokenAmount(1_000_000_000n, 6, { grouping: false })).toBe("1000");
  });

  it("handles negatives and never prints -0", () => {
    expect(formatTokenAmount(-1_500_000n, 6)).toBe("-1.5");
    expect(formatTokenAmount(-1n, 6, { maxFractionDigits: 2 })).toBe("0");
  });

  it("supports 0 decimals and rejects bad decimals", () => {
    expect(formatTokenAmount(1234n, 0)).toBe("1,234");
    expect(() => formatTokenAmount(1n, -1)).toThrow(RangeError);
  });
});

describe("formatSkr / formatSol", () => {
  it("labels SKR (mainnet default) and allows a label override", () => {
    expect(formatSkr(12_500_000n)).toBe("12.5 SKR");
    expect(formatSkr(12_500_000n, { label: "tSKR" })).toBe("12.5 tSKR");
  });

  it("formats lamports as SOL with 4 fraction digits", () => {
    expect(formatSol(1_000_000_000n)).toBe("1 SOL");
    expect(formatSol(12_345_678n)).toBe("0.0123 SOL");
  });
});

describe("parseTokenAmount", () => {
  it("parses decimals into base units", () => {
    expect(parseTokenAmount("12", 6)).toBe(12_000_000n);
    expect(parseTokenAmount("12.5", 6)).toBe(12_500_000n);
    expect(parseTokenAmount(" .5 ", 6)).toBe(500_000n);
    expect(parseTokenAmount("1,000.000001", 6)).toBe(1_000_000_001n);
    expect(parseTokenAmount("7.", 6)).toBe(7_000_000n);
  });

  it("rejects junk, negatives, empty and too many decimals", () => {
    for (const bad of ["", ".", "-1", "1e3", "abc", "1.2.3", "0.0000001"]) {
      expect(parseTokenAmount(bad, 6)).toBeNull();
    }
  });

  it("round-trips with formatTokenAmount", () => {
    for (const v of [0n, 1n, 10_000_000n, 123_456_789n]) {
      expect(parseTokenAmount(formatTokenAmount(v, 6), 6)).toBe(v);
    }
  });
});

describe("shortenAddress", () => {
  it("keeps head and tail", () => {
    expect(shortenAddress("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3")).toBe("SKRb…ZhW3");
    expect(shortenAddress("abc")).toBe("abc");
  });
});
