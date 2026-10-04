import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { PlayIcon } from "@/components/icons/Icons";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "lg";

interface ButtonOwnProps {
  variant: ButtonVariant;
  /** md = 48 px tall, lg = 56 px tall. Default md. */
  size?: ButtonSize;
  /** Leading icon (decorative; the label names the action). */
  icon?: ReactNode;
  /** Round ▶ end cap, the signature "start" CTA. */
  trailingPlay?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  children?: ReactNode;
}

type AsButton = ButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps> & { href?: undefined };

type AsLink = ButtonOwnProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonOwnProps | "href"> & {
    /** Renders a next/link. */
    href: string;
    /** A disabled link renders as a non-interactive element with aria-disabled. */
    disabled?: boolean;
    prefetch?: boolean;
  };

export type ButtonProps = AsButton | AsLink;

const OWN_KEYS = ["variant", "size", "icon", "trailingPlay", "block", "children", "className"] as const;

/** Strips Button's own props, leaving the native attributes to spread onto the element. */
function omitOwn<P extends ButtonProps>(props: P): Omit<P, (typeof OWN_KEYS)[number]> {
  const rest: Record<string, unknown> = { ...props };
  for (const key of OWN_KEYS) delete rest[key];
  return rest as Omit<P, (typeof OWN_KEYS)[number]>;
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Pill button. `primary` is lime on near-black (black ink inside a LimeMoment), `secondary` a
 * raised surface with a hairline, `ghost` text-only, `danger` red. `trailingPlay` adds the round
 * ▶ end cap. With `href` it renders a next/link styled identically.
 */
export default function Button(props: ButtonProps) {
  const { variant, size = "md", icon, trailingPlay = false, block = false, children, className } = props;

  const classes = cx(
    styles.button,
    styles[variant],
    styles[size],
    trailingPlay && styles.withCap,
    block && styles.block,
    className,
  );

  const content = (
    <>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className={styles.label}>{children}</span>
      {trailingPlay ? (
        <span className={styles.cap} aria-hidden="true" data-testid="button-play-cap">
          <PlayIcon size={size === "lg" ? 20 : 18} />
        </span>
      ) : null}
    </>
  );

  if (props.href !== undefined) {
    const { href, disabled, prefetch, ...rest } = omitOwn(props);
    if (disabled) {
      return (
        <span className={cx(classes, styles.disabled)} aria-disabled="true" role="link">
          {content}
        </span>
      );
    }
    return (
      <Link href={href} prefetch={prefetch} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  const { type = "button", ...rest } = omitOwn(props);
  return (
    <button type={type} className={classes} {...rest}>
      {content}
    </button>
  );
}
