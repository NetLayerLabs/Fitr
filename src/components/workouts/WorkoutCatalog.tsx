"use client";

import { exercisesByCategory } from "@/lib/exercises";
import { useT } from "@/lib/i18n/I18nProvider";
import { categoryDescription } from "@/lib/i18n/exercise";
import ProWorkouts from "@/components/pro/ProWorkouts";
import CategoryChips from "./CategoryChips";
import WorkoutCard from "./WorkoutCard";
import { categoryCounts, categoryLabel, type CatalogFilter } from "./catalog";
import styles from "./workouts.module.css";

export interface WorkoutCatalogProps {
  filter: CatalogFilter;
  /** Omitted for the static (pre-hydration) render. */
  onChange?: (filter: CatalogFilter) => void;
}

/**
 * The full catalogue: a sticky chip bar, then one 2-column grid section per category (or only
 * the chosen one). Pure and prop-driven; WorkoutCatalogRoute binds it to the URL.
 */
export default function WorkoutCatalog({ filter, onChange }: WorkoutCatalogProps) {
  const t = useT("workouts");
  const tx = useT("exercises");
  const { category, noEquipment } = filter;
  const counts = categoryCounts(noEquipment);
  const sections = exercisesByCategory()
    .filter((section) => category === "all" || section.id === category)
    .map((section) => ({
      ...section,
      exercises: noEquipment ? section.exercises.filter((info) => info.equipment === "none") : section.exercises,
    }))
    // In "All", a category with nothing left after the equipment toggle is simply left out.
    .filter((section) => category !== "all" || section.exercises.length > 0);

  const resultText =
    category === "all"
      ? t.plural("resultCount", counts[category])
      : t.plural("resultCountInCategory", counts[category], { category: categoryLabel(category, t, tx) });

  return (
    <div className={styles.catalog}>
      <div className={styles.chipBar}>
        <CategoryChips
          value={category}
          onChange={(next) => onChange?.({ category: next, noEquipment })}
          label={t("filterByCategory")}
          counts={counts}
        >
          <span className={styles.chipDivider} aria-hidden="true" />
          <button
            type="button"
            className={styles.chip}
            data-toggle="equipment"
            aria-pressed={noEquipment}
            onClick={() => onChange?.({ category, noEquipment: !noEquipment })}
          >
            {t("noEquipment")}
          </button>
        </CategoryChips>
      </div>

      <p className={styles.resultCount} role="status">
        {noEquipment ? t("resultNoEquipment", { result: resultText }) : resultText}
      </p>

      {sections.map((section, sectionIndex) => (
        <section key={section.id} className={styles.catSection} aria-labelledby={`cat-${section.id}`}>
          <div className={styles.catHead}>
            <h2 id={`cat-${section.id}`} className={styles.catTitle}>
              {categoryLabel(section.id, t, tx)}
            </h2>
            <p className={styles.catDescription}>{categoryDescription(tx, section.id)}</p>
          </div>
          {section.exercises.length > 0 ? (
            <ul className={styles.grid} role="list">
              {section.exercises.map((info, i) => (
                <li key={info.kind} className={styles.gridItem}>
                  {/* Only the very first photo is above the fold; the rest lazy-load. */}
                  <WorkoutCard info={info} variant="grid" priority={sectionIndex === 0 && i === 0} />
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>
              <p>{t("emptyNeedsEquipment", { category: categoryLabel(section.id, t, tx) })}</p>
              <button
                type="button"
                className={styles.emptyAction}
                onClick={() => onChange?.({ category, noEquipment: false })}
              >
                {t("showWithEquipment")}
              </button>
            </div>
          )}
        </section>
      ))}

      {/* Fitr Pro teaser: only on the full catalogue, never inside one category. */}
      {category === "all" ? <ProWorkouts /> : null}
    </div>
  );
}
