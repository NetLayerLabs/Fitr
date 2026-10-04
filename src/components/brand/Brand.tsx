/**
 * Official Fitr brand artwork (transparent PNGs in public/brand, generated from the logo files):
 * the "Fitr" wordmark for headers/footers and the "F" mark for app-icon spots.
 * Plain <img>: tiny, pre-sized, cached offline by the service worker.
 */

export interface WordmarkProps {
  /** Rendered height in px; width follows the artwork's aspect ratio. */
  height?: number;
  className?: string;
  /** Pass "" when a visible "Fitr" label already names the link. */
  alt?: string;
}

const WORDMARK_RATIO = 1003 / 356;

export function Wordmark({ height = 28, className, alt = "Fitr" }: WordmarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset
    <img
      src="/brand/fitr-wordmark-sm.png"
      srcSet="/brand/fitr-wordmark-sm.png 1x, /brand/fitr-wordmark.png 2x"
      alt={alt}
      width={Math.round(height * WORDMARK_RATIO)}
      height={height}
      className={className}
      decoding="async"
      style={{ height, width: "auto" }}
    />
  );
}

export interface BrandMarkProps {
  size?: number;
  className?: string;
  alt?: string;
}

export function BrandMark({ size = 32, className, alt = "" }: BrandMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset
    <img
      src="/brand/fitr-mark.png"
      alt={alt}
      width={size}
      height={size}
      className={className}
      decoding="async"
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
