/**
 * Display + input helpers for token amounts. Pure: no network, no React.
 *
 * Amounts are integer base units (bigint). Formatting truncates toward zero so a balance is
 * never shown larger than it is.
 */
import { SKR_DECIMALS, solanaConfig } from "./config";

export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const SOL_DECIMALS = 9;

export interface FormatAmountOptions {
  /** Most fraction digits to show (default: all `decimals`). Extra digits are truncated. */
  maxFractionDigits?: number;
  /** Fewest fraction digits to show, padded with zeros (default 0). */
  minFractionDigits?: number;
  /** Thousands separators in the whole part (default true). */
  grouping?: boolean;
}

function groupThousands(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 1234500000n, 6 -> "1,234.5". Never uses floats. */
export function formatTokenAmount(amount: bigint, decimals: number, opts: FormatAmountOptions = {}): string {
  if (!Number.isInteger(decimals) || decimals < 0) throw new RangeError("decimals must be a non-negative integer");
  const maxFrac = Math.min(opts.maxFractionDigits ?? decimals, decimals);
  const minFrac = Math.min(opts.minFractionDigits ?? 0, maxFrac);
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = (abs / base).toString();
  let frac = decimals > 0 ? (abs % base).toString().padStart(decimals, "0").slice(0, maxFrac) : "";
  frac = frac.replace(/0+$/, "");
  if (frac.length < minFrac) frac = frac.padEnd(minFrac, "0");
  const wholeOut = opts.grouping === false ? whole : groupThousands(whole);
  const body = frac ? `${wholeOut}.${frac}` : wholeOut;
  // Truncation can turn a tiny negative into zero; never print "-0".
  return negative && /[1-9]/.test(body) ? `-${body}` : body;
}

/** "12.5 SKR" (or "12.5 tSKR" in devnet test mode). 6-decimal SKR, truncated, not rounded. */
export function formatSkr(
  amount: bigint,
  opts: FormatAmountOptions & { label?: string } = {},
): string {
  const { label = solanaConfig.tokenLabel, ...rest } = opts;
  return `${formatTokenAmount(amount, SKR_DECIMALS, rest)} ${label}`;
}

/** Lamports -> "0.0123 SOL" (4 fraction digits by default). */
export function formatSol(lamports: bigint, opts: FormatAmountOptions = {}): string {
  return `${formatTokenAmount(lamports, SOL_DECIMALS, { maxFractionDigits: 4, ...opts })} SOL`;
}

/**
 * Parses user input ("12", "12.5", "1,000.25", " .5 ") into base units. Returns null for anything
 * that is not a non-negative decimal or that has more fraction digits than `decimals`.
 */
export function parseTokenAmount(text: string, decimals: number): bigint | null {
  const cleaned = text.trim().replace(/,/g, "");
  const match = /^(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) return null;
  const [, whole = "", frac = ""] = match;
  if (whole === "" && frac === "") return null;
  if (frac.length > decimals) return null;
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
}

/** "7xKX…9fQa" style short form for display. Full address stays available for copy/links. */
export function shortenAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 1) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}
