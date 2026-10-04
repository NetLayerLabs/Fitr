/**
 * Outbound links from the public landing page. In production the page is served as
 * https://fitr.day/ (nginx proxies it from this app's /landing route) while the app itself lives
 * on https://app.fitr.day, so every app link is absolute. Static art stays root-relative because
 * fitr.day serves /art/* too.
 */
export const APP_ORIGIN = "https://app.fitr.day";
export const SITE_ORIGIN = "https://fitr.day";

export const LANDING_LINKS = {
  app: APP_ORIGIN,
  commit: `${APP_ORIGIN}/commit`,
  workouts: `${APP_ORIGIN}/workouts`,
  privacy: `${APP_ORIGIN}/you/privacy`,
  verification: `${APP_ORIGIN}/you/verification`,
  credits: `${APP_ORIGIN}/you/credits`,
  apk: `${SITE_ORIGIN}/download/fitr.apk`,
} as const;

/** Small print under every Android download button. */
export const APK_NOTE = "Seeker & Android 9+ · APK";
