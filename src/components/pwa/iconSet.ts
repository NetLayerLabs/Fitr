import type { IconVariant } from "./iconArt";

/** Brand colors shared by the manifest, the icons and the offline page. */
export const BRAND_BACKGROUND = "#0A0B0D";
/** Lime accent, mirrors --lime-400 / --accent in src/app/globals.css. */
export const BRAND_ACCENT = "#C6F432";
/** Same lime as "r, g, b" for rgba() washes (the icon ring track). */
export const BRAND_ACCENT_RGB = "198, 244, 50";

/**
 * PNG icons served at /icons/<file>, statically generated at build time by
 * src/app/icons/[name]/route.tsx and referenced from the web app manifest.
 * Bubblewrap (TWA) downloads these same files when it generates the Android launcher icons.
 */
export const PWA_ICONS = {
  "icon-192.png": { size: 192, variant: "any", purpose: "any" },
  "icon-512.png": { size: 512, variant: "any", purpose: "any" },
  "maskable-512.png": { size: 512, variant: "maskable", purpose: "maskable" },
} as const satisfies Record<string, { size: number; variant: IconVariant; purpose: "any" | "maskable" }>;

export type PwaIconFile = keyof typeof PWA_ICONS;

export function isPwaIconFile(name: string): name is PwaIconFile {
  return Object.prototype.hasOwnProperty.call(PWA_ICONS, name);
}

export function pwaIconUrl(file: PwaIconFile): string {
  return `/icons/${file}`;
}
