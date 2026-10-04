import { ExerciseIcon } from "@/components/icons/Icons";
import { exerciseArt } from "@/lib/exerciseArt";
import type { ExerciseKind } from "@/lib/pose/types";
import styles from "./ExerciseThumb.module.css";

export interface ExerciseThumbProps {
  kind: ExerciseKind;
  /** Diameter in px. */
  size?: number;
  className?: string;
}

/**
 * Round photo thumbnail of the athlete in this exercise's pose, for list rows (history,
 * records, today's activity, the stake picker). Decorative: the row's text names the
 * exercise. Falls back to the line icon when no photo exists.
 */
export default function ExerciseThumb({ kind, size = 40, className }: ExerciseThumbProps) {
  const art = exerciseArt(kind);
  const cls = [styles.thumb, className].filter(Boolean).join(" ");
  if (!art) {
    return (
      <span className={`${cls} ${styles.icon}`} style={{ width: size, height: size }} aria-hidden="true">
        <ExerciseIcon kind={kind} size={Math.round(size * 0.55)} />
      </span>
    );
  }
  return (
    <span className={cls} style={{ width: size, height: size }} data-framing={art.framing} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized local thumb; SW caches it offline */}
      <img src={art.thumb} alt="" width={size} height={size} loading="lazy" decoding="async" className={styles.img} />
    </span>
  );
}
