import { Fragment, type ReactNode } from "react";
import styles from "./SkrAmount.module.css";

/**
 * The official $SKR token logo (from the mint's onchain metadata:
 * r2.solanamobiledappstore.com/skr/seeker.png), shown after amounts instead of the "SKR" text.
 * Screen readers (and textContent) still read "15 SKR": the logo is aria-hidden and the label is visually hidden.
 */
export function SkrLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static token logo
    <img
      src="/brand/skr-token.png"
      srcSet="/brand/skr-token.png 1x, /brand/skr-token@2x.png 2x"
      alt=""
      aria-hidden="true"
      width={16}
      height={16}
      decoding="async"
      className={[styles.logo, className].filter(Boolean).join(" ")}
    />
  );
}

export interface SkrAmountProps {
  /** Formatted number, e.g. "15" or "1,250.5" (without the token label). */
  value: string;
  /** "SKR" on mainnet, "tSKR" in devnet test mode (spoken, and shown as a tag for test tokens). */
  label?: string;
  className?: string;
}

/** "15 ⓢ": the amount followed by the SKR logo. */
export function SkrAmount({ value, label = "SKR", className }: SkrAmountProps) {
  return (
    <span className={[styles.amount, className].filter(Boolean).join(" ")}>
      {value}
      <SkrLogo />
      {label !== "SKR" ? (
        <span className={styles.testTag}>
          <span className="sr-only"> </span>
          {label}
        </span>
      ) : (
        <span className="sr-only"> {label}</span>
      )}
    </span>
  );
}

const TOKEN_AMOUNT = /([+−-]?\d[\d,]*(?:\.\d+)?)\s?(tSKR|SKR)\b/g;

/**
 * Renders a string, replacing every "<number> SKR" (or tSKR) with the number + logo.
 * Useful for labels that are built as strings, e.g. "Commit 15 SKR" or "100 +40.7 SKR".
 * Text without amounts (e.g. "Stake SKR on today's workout") is left untouched.
 */
export function SkrText({ text, className }: { text: string; className?: string }): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_AMOUNT)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    parts.push(<SkrAmount key={i} value={m[1]} label={m[2]} />);
    last = i + m[0].length;
  }
  if (last === 0) return className ? <span className={className}>{text}</span> : text;
  if (last < text.length) parts.push(text.slice(last));
  return (
    <span className={className}>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </span>
  );
}
