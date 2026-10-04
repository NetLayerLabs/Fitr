import type { ReactNode } from "react";
import type { IconProps } from "@/components/icons/Icons";

/** Landing-only glyphs, drawn on the same 24 px / 1.75 px round-stroke grid as the app icons. */
function Glyph({ size = 24, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 4v11" />
      <path d="m7 10.5 5 5 5-5" />
      <path d="M5 19.5h14" />
    </Glyph>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M7 17 17 7" />
      <path d="M8.5 7H17v8.5" />
    </Glyph>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3.5 3.5l17 17" />
      <path d="M10.6 5.6A9.7 9.7 0 0 1 12 5.5c5 0 8.5 4.6 9 6.5-.2.8-1 2.2-2.3 3.6" />
      <path d="M6.6 6.9C4.6 8.3 3.3 10.4 3 12c.5 1.9 4 6.5 9 6.5 1.6 0 3-.5 4.3-1.1" />
      <path d="M9.9 10a3 3 0 0 0 4.1 4.1" />
    </Glyph>
  );
}

export function ChainIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </Glyph>
  );
}

export function PercentIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M18 6 6 18" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </Glyph>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.7-8.7" />
      <path d="m16.5 6.5 2.5 2.5" />
      <path d="m14 9 2 2" />
    </Glyph>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </Glyph>
  );
}
