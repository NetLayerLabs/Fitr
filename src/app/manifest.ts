import type { MetadataRoute } from "next";
import { EXERCISE_LIST } from "@/lib/exercises";
import { BRAND_BACKGROUND, PWA_ICONS, pwaIconUrl, type PwaIconFile } from "@/components/pwa/iconSet";

/**
 * Web app manifest, served at /manifest.webmanifest (Next links it from <head> automatically).
 * Also the input for Bubblewrap when packaging the Android TWA (see docs/twa.md), so keep
 * `id`, `start_url` and `scope` stable: changing `id` makes installs look like a new app.
 */
export default function manifest(): MetadataRoute.Manifest {
  const icons = (Object.keys(PWA_ICONS) as PwaIconFile[]).map((file) => {
    const { size, purpose } = PWA_ICONS[file];
    return { src: pwaIconUrl(file), sizes: `${size}x${size}`, type: "image/png", purpose };
  });

  return {
    id: "/",
    name: "Fitr — Commit to your workout",
    short_name: "Fitr",
    description:
      "Stake SKR on a daily workout goal you choose. On-device AI pose tracking counts every rep, live challenges keep it cheat-resistant, and your camera feed never leaves your phone.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND_BACKGROUND,
    theme_color: BRAND_BACKGROUND,
    lang: "en",
    dir: "ltr",
    categories: ["health", "fitness", "sports"],
    prefer_related_applications: false,
    icons,
    shortcuts: EXERCISE_LIST.map((exercise) => ({
      name: `Start ${exercise.name}`,
      short_name: exercise.name,
      description: exercise.tagline,
      url: `/workout/${exercise.kind}`,
      icons: [{ src: pwaIconUrl("icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" }],
    })),
  };
}
