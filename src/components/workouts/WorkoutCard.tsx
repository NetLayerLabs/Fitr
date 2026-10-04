import Link from "next/link";
import { ExerciseIcon } from "@/components/icons/Icons";
import { formatGoal } from "@/components/workout/format";
import { exerciseArt } from "@/lib/exerciseArt";
import type { ExerciseInfo } from "@/lib/exercises";
import {
  LEVEL_LABEL,
  LEVEL_RANK,
  equipmentBadge,
  workoutAccessibleName,
  workoutHref,
} from "./catalog";
import { keepHyphenatedWords } from "@/components/ui/text";
import ArtPhoto from "./ArtPhoto";
import styles from "./workouts.module.css";

export interface WorkoutCardProps {
  info: ExerciseInfo;
  /** "compact" for the home carousel, "grid" for the /workouts grid (adds the tagline). */
  variant?: "compact" | "grid";
  /** The first card above the fold: its photo loads eagerly at high priority. */
  priority?: boolean;
}

function LevelDots({ info }: { info: ExerciseInfo }) {
  const rank = LEVEL_RANK[info.level];
  return (
    <span className={styles.level} data-level={info.level} title={LEVEL_LABEL[info.level]}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={styles.levelDot} data-on={i <= rank ? "" : undefined} />
      ))}
    </span>
  );
}

/**
 * One workout as a single link. The link's accessible name carries everything the visible
 * badges say ("Pull-ups, 8 reps, needs a bar, front camera, advanced"), so the inner text and
 * the athlete photo are presentation only.
 */
export default function WorkoutCard({ info, variant = "grid", priority = false }: WorkoutCardProps) {
  const gear = equipmentBadge(info.equipment);
  const front = info.camera === "front";
  const art = exerciseArt(info.kind);
  return (
    <Link
      href={workoutHref(info.kind)}
      className={styles.card}
      data-variant={variant}
      data-kind={info.kind}
      aria-label={workoutAccessibleName(info)}
    >
      <span className={styles.cardMedia} data-art={art ? "photo" : "icon"}
        data-framing={art?.framing}
        aria-hidden="true"
      >
        {art ? (
          <ArtPhoto
            art={art}
            decorative
            priority={priority}
            className={styles.cardPhoto}
            sizes={variant === "compact" ? "(max-width: 480px) 40vw, 180px" : "(max-width: 480px) 46vw, 240px"}
          />
        ) : (
          <span className={styles.cardIcon}>
            <ExerciseIcon kind={info.kind} size={variant === "compact" ? 30 : 36} />
          </span>
        )}
      </span>
      <span className={styles.cardBody} aria-hidden="true">
        <span className={styles.cardName}>{keepHyphenatedWords(info.name)}</span>
        {variant === "grid" ? <span className={styles.cardTagline}>{info.tagline}</span> : null}
        <span className={styles.cardMeta}>
          <span className={styles.cardGoal}>{formatGoal(info.defaultGoal, info.unit)}</span>
          {gear ? (
            <span className={styles.badge} data-badge="equipment">
              {gear}
            </span>
          ) : null}
          {front ? (
            <span className={styles.badge} data-badge="camera">
              Front camera
            </span>
          ) : null}
          <LevelDots info={info} />
        </span>
      </span>
    </Link>
  );
}
