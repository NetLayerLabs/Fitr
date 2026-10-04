import type { JSX, ReactNode, SVGProps } from "react";
import {
  ARC_END,
  ARC_PATH,
  F_BARS,
  KNOB_RADIUS,
  MARK_VIEWBOX,
  RING_RADIUS,
  RING_STROKE,
  RING_STROKE_SMALL,
  TRACK_OPACITY,
} from "@/components/pwa/markGeometry";
import type { ExerciseKind } from "@/lib/pose/types";

/**
 * Inline SVG icon set (24x24 grid, 1.75px round strokes, currentColor).
 * Decorative by default (aria-hidden); pass a `title` to give an icon an accessible name.
 * Pass `strokeWidth` to override the weight (e.g. 2.25 for an active tab).
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
  title?: string;
}

function Icon({
  size = 24,
  title,
  children,
  ...rest
}: IconProps & { children: ReactNode }) {
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

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </Icon>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8.25" />
      <path d="M3 3.5v4.75h4.75" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3c.5 3.2 5 5.2 5 10a5 5 0 0 1-10 0c0-2.1.9-3.7 2.2-4.8.2 1.7 1 2.8 2.3 3.1C11 8.6 10.9 5.6 12 3Z" />
    </Icon>
  );
}

export function PushupIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="4.5" cy="9" r="1.75" />
      <path d="M6.5 10.5 20 14.5" />
      <path d="M9 11.25V17" />
      <path d="M20 14.5 21 17" />
      <path d="M2.5 19.5h19" />
    </Icon>
  );
}

export function SquatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="13" cy="4" r="1.75" />
      <path d="M13 6.5 11.5 12h-4" />
      <path d="M7.5 12 10 16.5 9 20.5" />
      <path d="M12.5 8.5 17 10" />
      <path d="M5 20.5h14" />
    </Icon>
  );
}

export function PlankIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="4" cy="11" r="1.75" />
      <path d="M6 12.5 21 15" />
      <path d="M7.5 12.75V17h3.5" />
      <path d="M2.5 19.5h19" />
    </Icon>
  );
}

export function LungeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="3.75" r="1.75" />
      <path d="M12 6.25v6.25" />
      <path d="M12 7.5 13.5 11.5" />
      <path d="M12 12.5 16.5 13.5V20" />
      <path d="M12 12.5 9.5 18.75 5.5 20" />
      <path d="M3 21.25h18" />
    </Icon>
  );
}

export function SitupIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8.25" cy="7.25" r="1.75" />
      <path d="M9.25 9.75 8 18" />
      <path d="M9.25 11.25 12.5 13.5" />
      <path d="M8 18 14 12.5 18.5 18.5" />
      <path d="M2.5 19.5h19" />
    </Icon>
  );
}

export function LegRaiseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="4" cy="16.75" r="1.75" />
      <path d="M6.25 17.5H14" />
      <path d="M14 17.5 15.5 5.5" />
      <path d="M2.5 19.5h19" />
    </Icon>
  );
}

export function GluteBridgeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="3.75" cy="16.75" r="1.75" />
      <path d="M6 17.5 12 12l4.5-1.5 1.5 8" />
      <path d="M2.5 19.5h19" />
    </Icon>
  );
}

export function WallSitIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 3v18" />
      <circle cx="8.25" cy="5" r="1.75" />
      <path d="M7.5 7.5V14H14v6.5" />
      <path d="M7.5 9 11 11.5" />
      <path d="M4.5 21H20" />
    </Icon>
  );
}

export function PikePushupIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="15.25" r="1.6" />
      <path d="M8 13 13 6l6.5 13" />
      <path d="M8 13 7.5 19" />
      <path d="M2.5 19.5h19" />
    </Icon>
  );
}

export function JumpSquatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="3.5" r="1.75" />
      <path d="M12 6v6.5" />
      <path d="M12 7.5 8.5 4.5" />
      <path d="M12 7.5 15.5 4.5" />
      <path d="M12 12.5 10 17" />
      <path d="M12 12.5 14 17" />
      <path d="M7.5 21h3" />
      <path d="M13.5 21h3" />
    </Icon>
  );
}

export function PullupIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 3.5h18" />
      <circle cx="12" cy="6.75" r="1.75" />
      <path d="M8 3.5 9.5 10h5L16 3.5" />
      <path d="M12 9.5V16" />
      <path d="M12 16 10.5 21" />
      <path d="M12 16 13.5 21" />
    </Icon>
  );
}

export function DipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 14h7.5" />
      <path d="M4 14v7" />
      <path d="M9.5 14v7" />
      <circle cx="11.5" cy="5.5" r="1.75" />
      <path d="M11.5 8 12 15h5v6" />
      <path d="M11.5 9 8 11l1.5 3" />
    </Icon>
  );
}

export function BurpeeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="4.5" cy="14.5" r="1.5" />
      <path d="M6.25 15.5 13 18" />
      <path d="M7.25 16v3.5" />
      <path d="M2.5 20h12" />
      <path d="M18.5 20V5" />
      <path d="m15.5 8 3-3 3 3" />
    </Icon>
  );
}

export function MountainClimberIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="4.5" cy="9" r="1.75" />
      <path d="M6.5 10.5 14 14l7 3.5" />
      <path d="M7.5 11v6.5" />
      <path d="M14 14 10 15l1.5 3" />
      <path d="M2.5 19.5h19" />
    </Icon>
  );
}

export function JumpingJackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="4" r="1.75" />
      <path d="M12 6.5v7" />
      <path d="M12 8 6 3.5" />
      <path d="M12 8l6-4.5" />
      <path d="M12 13.5 7 20.5" />
      <path d="M12 13.5l5 7" />
    </Icon>
  );
}

export function HighKneesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="3.5" r="1.75" />
      <path d="M12 6v6.5" />
      <path d="M12 7.5 8.5 10.5" />
      <path d="M12 7.5 15 5.5" />
      <path d="M12 12.5 11 20.5" />
      <path d="M12 12.5h4l-.5 4.5" />
      <path d="M7 21.25h10" />
    </Icon>
  );
}

const EXERCISE_ICONS: Record<ExerciseKind, (props: IconProps) => JSX.Element> = {
  pushup: PushupIcon,
  squat: SquatIcon,
  plank: PlankIcon,
  lunge: LungeIcon,
  situp: SitupIcon,
  leg_raise: LegRaiseIcon,
  glute_bridge: GluteBridgeIcon,
  wall_sit: WallSitIcon,
  pike_pushup: PikePushupIcon,
  jump_squat: JumpSquatIcon,
  pullup: PullupIcon,
  dip: DipIcon,
  burpee: BurpeeIcon,
  mountain_climber: MountainClimberIcon,
  jumping_jack: JumpingJackIcon,
  high_knees: HighKneesIcon,
};

export function ExerciseIcon({ kind, ...props }: IconProps & { kind: ExerciseKind }) {
  const Component = EXERCISE_ICONS[kind];
  return <Component {...props} />;
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 5 7 7-7 7" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Icon>
  );
}

export function CameraFlipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <path d="M9 13.5a3 3 0 0 1 5.2-2" />
      <path d="M15 13.5a3 3 0 0 1-5.2 2" />
      <path d="M14.5 9.5v2h-2" />
      <path d="M9.5 17.5v-2h2" />
    </Icon>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </Icon>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 19.5h4l10-10a2.83 2.83 0 0 0-4-4l-10 10v4Z" />
      <path d="m13.5 6.5 4 4" />
    </Icon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </Icon>
  );
}

export function ExpandIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
    </Icon>
  );
}

export function ShrinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 4v5H4" />
      <path d="M15 4v5h5" />
      <path d="M9 20v-5H4" />
      <path d="M15 20v-5h5" />
    </Icon>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4.5v15l12.5-7.5L7 4.5Z" fill="currentColor" />
    </Icon>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" />
      <path d="M4 3.5V8h4.5" />
      <path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" />
      <path d="M20 20.5V16h-4.5" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
    </Icon>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H4.5a3 3 0 0 0 3.5 4" />
      <path d="M16 6h3.5a3 3 0 0 1-3.5 4" />
      <path d="M12 13v4" />
      <path d="M8.5 20.5h7" />
      <path d="M10 17h4v3.5h-4z" />
    </Icon>
  );
}

export function CoinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.8 9.2c-.6-.8-1.6-1.2-2.8-1.2-1.7 0-2.8.9-2.8 2s1 1.7 2.8 2 2.8.9 2.8 2-1.1 2-2.8 2c-1.2 0-2.3-.4-2.9-1.3" />
      <path d="M12 6.5V8" />
      <path d="M12 16v1.5" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  );
}

/** Commit tab: a target (goal locked in). */
export function TargetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.75" fill="currentColor" />
    </Icon>
  );
}

/** Workouts tab. */
export function DumbbellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 12h8" />
      <rect x="4.5" y="7" width="3.5" height="10" rx="1.25" />
      <rect x="16" y="7" width="3.5" height="10" rx="1.25" />
      <path d="M2.5 10v4" />
      <path d="M21.5 10v4" />
    </Icon>
  );
}

/** Progress tab: rising bars. */
export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 20v-6" />
      <path d="M12 20V9" />
      <path d="M19 20V4" />
    </Icon>
  );
}

/** You tab. */
export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </Icon>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <rect x="4" y="8" width="16.5" height="11.5" rx="2.5" />
      <path d="M16.5 13.75h.01" strokeWidth={2.5} />
    </Icon>
  );
}

/**
 * Fitr brand mark, the same artwork as the app icon and splash (see pwa/markGeometry.ts): a
 * geometric "F" inside a rep-progress ring, drawn in currentColor. Below 32 px it uses the
 * favicon treatment (heavier ring, no track or knob) so it stays legible.
 */
export function FitrMark({ size = 24, title, ...rest }: IconProps) {
  const small = size < 32;
  return (
    <svg
      width={size}
      height={size}
      viewBox={MARK_VIEWBOX}
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {small ? null : (
        <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="currentColor" strokeOpacity={TRACK_OPACITY} strokeWidth={RING_STROKE} />
      )}
      <path
        d={ARC_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={small ? RING_STROKE_SMALL : RING_STROKE}
        strokeLinecap="round"
      />
      {small ? null : <circle cx={ARC_END.x} cy={ARC_END.y} r={KNOB_RADIUS} />}
      {F_BARS.map((bar, i) => (
        <rect key={i} {...bar} />
      ))}
    </svg>
  );
}
