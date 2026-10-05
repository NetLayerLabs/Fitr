"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { useT } from "@/lib/i18n/I18nProvider";

export interface BackLinkProps {
  /** Where to go when there is no in-app page to return to (deep link, fresh tab). */
  fallback: string;
  className?: string;
  /** Accessible name; defaults to "Back" in the app's language. */
  label?: string;
  children: ReactNode;
}

/**
 * Whether going back should stay inside the app. A fresh tab or deep link has no earlier entry;
 * a page opened from another site has a foreign referrer. Client-side navigations keep the
 * first page's referrer, so a mis-guess only ever lands on `fallback`, which is a sensible page.
 */
function canGoBackInApp(): boolean {
  if (typeof window === "undefined" || window.history.length <= 1) return false;
  if (document.referrer === "") return true;
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Back arrow that returns to wherever the user came from (e.g. the Workouts menu or Today),
 * and falls back to `fallback` when the page was opened directly. Still a real link, so it
 * works without JavaScript and reads as navigation to assistive tech.
 */
export default function BackLink({ fallback, className, label, children }: BackLinkProps) {
  const t = useT("common");
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (canGoBackInApp()) {
      event.preventDefault();
      window.history.back();
    }
  }

  return (
    <Link href={fallback} className={className} aria-label={label ?? t("back")} onClick={onClick}>
      {children}
    </Link>
  );
}
