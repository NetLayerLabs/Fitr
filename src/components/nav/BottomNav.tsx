"use client";

import type { JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconProps } from "@/components/icons/Icons";
import { WorkoutsIcon } from "@/components/workouts/WorkoutsIcon";
import { isExerciseKind } from "@/lib/pose/types";
import { CommitIcon, ProgressIcon, TodayIcon, YouIcon } from "./NavIcons";
import styles from "./BottomNav.module.css";

export interface NavItem {
  href: string;
  label: string;
  Icon: (props: IconProps) => JSX.Element;
  /** The centre tab: a raised lime button. */
  primary?: boolean;
  /** Extra path prefixes that keep this tab active (e.g. /workout/<kind> 404s under Workouts). */
  also?: readonly string[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Today", Icon: TodayIcon },
  { href: "/workouts", label: "Workouts", Icon: WorkoutsIcon },
  { href: "/commit", label: "Commit", Icon: CommitIcon, primary: true },
  { href: "/progress", label: "Progress", Icon: ProgressIcon, also: ["/history"] },
  { href: "/you", label: "You", Icon: YouIcon, also: ["/wallet"] },
];

function matches(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Whether `item` is the current tab for `pathname`. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return matches(pathname, item.href) || (item.also ?? []).some((p) => matches(pathname, p));
}

/** Workout screens (/workout/<known exercise>) run full-screen; a 404 under /workout keeps the nav. */
function isWorkoutScreen(pathname: string): boolean {
  const match = /^\/workout\/([^/]+)\/?$/.exec(pathname);
  return match !== null && isExerciseKind(match[1]);
}

/**
 * Whether the tab bar is shown at `pathname`. The public landing page also hides it, but via
 * CSS on its content (globals.css: [data-page="landing"]): on fitr.day the landing is a host
 * rewrite of "/", so the server sees "/landing" while the browser sees "/". A pathname check
 * here would render differently on each side and break hydration.
 */
export function isBottomNavVisible(pathname: string): boolean {
  return !isWorkoutScreen(pathname);
}

/**
 * Sticky five-tab bar: Today · Workouts · Commit · Progress · You. Commit is the raised lime
 * centre button. Hidden on the live workout screens so the camera can use the full height; the
 * public landing page hides it with CSS (see isBottomNavVisible).
 */
export default function BottomNav() {
  const pathname = usePathname() ?? "/";
  if (!isBottomNavVisible(pathname)) return null;

  return (
    <nav className={styles.nav} aria-label="Primary" data-bottom-nav="">
      <ul className={styles.list} role="list">
        {NAV_ITEMS.map((item) => {
          const { href, label, Icon, primary } = item;
          const active = isNavItemActive(item, pathname);
          return (
            <li key={href} className={styles.item}>
              <Link
                href={href}
                className={primary ? `${styles.link} ${styles.primary}` : styles.link}
                aria-current={active ? "page" : undefined}
                data-active={active || undefined}
              >
                {primary ? (
                  <span className={styles.primaryDisc} aria-hidden="true">
                    <Icon size={26} />
                  </span>
                ) : (
                  <Icon size={24} />
                )}
                <span className={styles.label}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
