import type { ReactNode } from "react";
import type { IconProps } from "@/components/icons/Icons";

/** Tab-bar icons, in the Icons.tsx style (24 grid, 2px round strokes, currentColor). */
function NavIcon({ size = 24, title, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** Today: a clock face (today's deadline). */
export function TodayIcon(props: IconProps) {
  return (
    <NavIcon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </NavIcon>
  );
}

/** Commit: a plus inside a bold ring, sits in the raised lime centre button. */
export function CommitIcon(props: IconProps) {
  return (
    <NavIcon strokeWidth={2.5} {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </NavIcon>
  );
}

/** Progress: rising bars. */
export function ProgressIcon(props: IconProps) {
  return (
    <NavIcon {...props}>
      <path d="M5 20v-6" />
      <path d="M12 20V9" />
      <path d="M19 20V4" />
    </NavIcon>
  );
}

/** You: person. */
export function YouIcon(props: IconProps) {
  return (
    <NavIcon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </NavIcon>
  );
}
