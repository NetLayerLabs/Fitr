import type { ExerciseArt } from "@/lib/exerciseArt";

export interface ArtPhotoProps {
  art: ExerciseArt;
  /** Rendered width hint for the browser's srcset pick, e.g. "(max-width: 420px) 45vw, 200px". */
  sizes: string;
  /**
   * true when a visible text label already names the exercise (cards): the photo is then
   * decorative and gets alt="". false keeps the catalog's descriptive alt.
   */
  decorative?: boolean;
  /** Only for the first image above the fold: loads eagerly at high priority. */
  priority?: boolean;
  className?: string;
}

/**
 * Athlete photo as a plain responsive <img>. Not next/image on purpose: the art is already
 * pre-sized (420 px + 960 px JPEGs, 20-80 KB), so the optimizer would only add server CPU on the
 * VPS and /_next/image URLs the offline service worker does not cache. The square intrinsic size
 * plus the container's aspect-ratio rule out layout shift.
 */
export default function ArtPhoto({ art, sizes, decorative = false, priority = false, className }: ArtPhotoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-sized static art, see above
    <img
      className={className}
      src={art.thumb}
      srcSet={`${art.thumb} 420w, ${art.src} 960w`}
      sizes={sizes}
      width={960}
      height={960}
      alt={decorative ? "" : art.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      draggable={false}
    />
  );
}
