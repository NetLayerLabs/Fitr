import type { IconProps } from "@/components/icons/Icons";

/** Dumbbell, in the Icons.tsx style (24 grid, 2px round strokes, currentColor). */
export function WorkoutsIcon({ size = 24, title, ...rest }: IconProps) {
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
      <path d="M8 12h8" />
      <rect x="4.5" y="7" width="3.5" height="10" rx="1" />
      <rect x="16" y="7" width="3.5" height="10" rx="1" />
      <path d="M2.5 10v4M21.5 10v4" />
    </svg>
  );
}
