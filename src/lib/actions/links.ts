/**
 * Public URLs for share cards, Blinks and the pool dashboard. Pure.
 *
 * All of these live on the public host https://fitr.day (nginx forwards /actions.json,
 * /api/actions/*, /s/* and /pool to the Next server). The app host (app.fitr.day) is never linked.
 */
import type { ExerciseKind } from "@/lib/pose/types";

export const PUBLIC_ORIGIN = "https://fitr.day";
export const APK_URL = `${PUBLIC_ORIGIN}/download/fitr.apk`;
export const POOL_DASHBOARD_URL = `${PUBLIC_ORIGIN}/pool`;
/** Square 960 px athlete photos (fitr.day serves /art/*). */
export const ACTION_ICON_URL = `${PUBLIC_ORIGIN}/art/exercises/stand-man.jpg`;

export function exerciseIconUrl(kind: ExerciseKind): string {
  return `${PUBLIC_ORIGIN}/art/exercises/${kind}-man.jpg`;
}

export const COMMIT_ACTION_PATH = "/api/actions/commit";
export const SPONSOR_ACTION_PATH = "/api/actions/sponsor";

function query(params: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Absolute "Commit with me" action URL. `pool` omitted = the global pool. */
export function commitActionUrl(p: { pool?: string | null; exercise?: ExerciseKind | null; goal?: number | null }): string {
  return `${PUBLIC_ORIGIN}${COMMIT_ACTION_PATH}${query({ pool: p.pool, exercise: p.exercise, goal: p.goal })}`;
}

/** Absolute "Sponsor a day" action URL. */
export function sponsorActionUrl(pool?: string | null): string {
  return `${PUBLIC_ORIGIN}${SPONSOR_ACTION_PATH}${query({ pool })}`;
}

/** dial.to interstitial: renders any action URL as a Blink in a normal browser. */
export function dialToUrl(actionUrl: string): string {
  return `https://dial.to/?action=${encodeURIComponent(`solana-action:${actionUrl}`)}`;
}

/** Path of a share card: /s/<wallet>/<dayIndex>[?pool=<addr>] (pool omitted = global pool). */
export function sharePath(p: { wallet: string; dayIndex: number; pool?: string | null }): string {
  return `/s/${encodeURIComponent(p.wallet)}/${p.dayIndex}${query({ pool: p.pool })}`;
}

export function shareUrl(p: { wallet: string; dayIndex: number; pool?: string | null }): string {
  return `${PUBLIC_ORIGIN}${sharePath(p)}`;
}
