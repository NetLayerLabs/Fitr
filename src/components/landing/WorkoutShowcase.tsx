import { exerciseArt } from "@/lib/exerciseArt";
import { EXERCISE_CATEGORIES, exercisesByCategory, type ExerciseInfo } from "@/lib/exercises";
import section from "./section.module.css";
import styles from "./WorkoutShowcase.module.css";

function goalLabel(info: ExerciseInfo): string {
  return info.unit === "seconds" ? `from ${info.minGoal} s` : `from ${info.minGoal} reps`;
}

/**
 * All 16 exercises as photo cards, grouped by category (a swipeable rail on phones). The cards
 * are informational: the app itself runs only inside the Android app, so there is nothing to link.
 */
export default function WorkoutShowcase() {
  const groups = exercisesByCategory();
  const cards = groups.flatMap((g) => g.exercises.map((info) => ({ info, category: g.label })));

  return (
    <section id="workouts" className={section.section} aria-labelledby="workouts-title">
      <div className={section.container}>
        <div className={`${styles.head} ${section.reveal}`}>
          <div className={section.head}>
            <p className={section.eyebrow}>The workouts</p>
            <h2 id="workouts-title" className={section.title}>
              {cards.length} exercises. No gym. No excuses.
            </h2>
            <p className={section.lede}>
              Bodyweight moves across {EXERCISE_CATEGORIES.length} groups, each with a clear rep
              standard the AI holds you to. Just you, the floor and your phone.
            </p>
          </div>
          <ul className={styles.categories} role="list" aria-label="Categories">
            {groups.map((g) => (
              <li key={g.id}>
                {g.label}
                <span className={styles.count}>{g.exercises.length}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.railWrap}>
        <ul className={styles.rail} role="list">
          {cards.map(({ info, category }) => {
            const art = exerciseArt(info.kind);
            return (
              <li key={info.kind} className={styles.cell}>
                <div className={styles.card}>
                  {art ? (
                    // eslint-disable-next-line @next/next/no-img-element -- pre-sized static art (see ArtPhoto)
                    <img
                      className={art.framing === "floor" ? `${styles.photo} ${styles.floor}` : styles.photo}
                      src={art.thumb}
                      width={420}
                      height={420}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  ) : null}
                  <span className={styles.meta}>
                    <span className={styles.category}>{category}</span>
                    <span className={styles.name}>{info.name}</span>
                    <span className={styles.goal}>Goal {goalLabel(info)}</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
