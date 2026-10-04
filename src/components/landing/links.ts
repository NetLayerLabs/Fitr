/**
 * Outbound links from the public landing page and its info pages. In production they are served
 * on https://fitr.day (nginx/rewrites map fitr.day paths onto this app's /landing routes). The
 * app itself (app.fitr.day) is reachable only from the Android app, so nothing here links into
 * it: every link is absolute on fitr.day. Static art stays root-relative because fitr.day serves
 * /art/* too.
 *
 * Public path → route mapping (host rewrites in next.config.ts for fitr.day / www.fitr.day):
 *   /              → /landing
 *   /verification  → /landing/verification
 *   /privacy       → /landing/privacy
 *   /credits       → /landing/credits
 * /pool, /s/*, /c/*, /actions.json and /api/actions/* are served as-is on fitr.day.
 */
export const SITE_ORIGIN = "https://fitr.day";

export const LANDING_LINKS = {
  home: `${SITE_ORIGIN}/`,
  apk: `${SITE_ORIGIN}/download/fitr.apk`,
  pool: `${SITE_ORIGIN}/pool`,
  verification: `${SITE_ORIGIN}/verification`,
  privacy: `${SITE_ORIGIN}/privacy`,
  credits: `${SITE_ORIGIN}/credits`,
} as const;

/** fitr.day public paths and the /landing routes that render them. */
export const LANDING_ROUTES = {
  "/": "/landing",
  "/verification": "/landing/verification",
  "/privacy": "/landing/privacy",
  "/credits": "/landing/credits",
} as const;

/** Small print under every Android download button. */
export const APK_NOTE = "Seeker & Android 9+ · APK";
