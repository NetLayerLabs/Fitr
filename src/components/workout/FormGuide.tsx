"use client";

import BackLink from "@/components/common/BackLink";
import { useState } from "react";
import { ArrowLeftIcon, CheckIcon, PlayIcon } from "@/components/icons/Icons";
import { useGuidePrefs } from "@/hooks/useGuidePrefs";
import ArtPhoto from "@/components/workouts/ArtPhoto";
import { ART_DEMONSTRATORS, exerciseArt } from "@/lib/exerciseArt";
import { EXERCISES } from "@/lib/exercises";
import { FORM_GUIDES, type Demonstrator } from "@/lib/formGuide";
import type { ExerciseKind } from "@/lib/pose/types";
import { setGuideHidden } from "@/lib/storage/guidePrefs";
import { keepHyphenatedWords } from "@/components/ui/text";
import GuideDemo from "./GuideDemo";
import PhonePlacement from "./PhonePlacement";
import styles from "./FormGuide.module.css";
import screen from "./WorkoutScreen.module.css";

const DEMONSTRATORS: ReadonlyArray<{ value: Demonstrator; label: string }> = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
];

export interface FormGuideProps {
  exercise: ExerciseKind;
  /** Called after the "don't show again" choice is saved. */
  onContinue: () => void;
}

/** Pre-workout form guide: demonstrator, three cues, phone placement, "don't show again". */
export default function FormGuide({ exercise, onContinue }: FormGuideProps) {
  const info = EXERCISES[exercise];
  const guide = FORM_GUIDES[exercise];
  const hiddenNow = useGuidePrefs()[exercise];
  const [dontShow, setDontShow] = useState(hiddenNow);

  const available = DEMONSTRATORS.filter((d) => guide.clips[d.value]);
  const [demonstrator, setDemonstrator] = useState<Demonstrator>(available[0]?.value ?? "woman");
  const clip = guide.clips[demonstrator];
  const exerciseName = info.name.toLowerCase();
  // Photo of the chosen demonstrator, else whoever has a photo set; null hides the photo header.
  const art = exerciseArt(exercise, demonstrator) ?? (ART_DEMONSTRATORS[0] ? exerciseArt(exercise, ART_DEMONSTRATORS[0]) : null);

  function handleContinue() {
    setGuideHidden(exercise, dontShow);
    onContinue();
  }

  return (
    <div className={screen.page}>
      <header className={screen.pageHeader}>
        <BackLink fallback="/workouts" className={screen.backLink} label="Back">
          <ArrowLeftIcon size={24} />
        </BackLink>
        <p className={screen.pageEyebrow}>Form guide</p>
      </header>

      {art ? (
        <div className={styles.hero} data-framing={art.framing}>
          {/* Above the fold: the one eager, high-priority image on this screen. */}
          <ArtPhoto art={art} priority className={styles.heroPhoto} sizes="(max-width: 600px) 100vw, 600px" />
          <h1 className={`${styles.title} ${styles.heroTitle}`}>{keepHyphenatedWords(guide.title)}</h1>
        </div>
      ) : (
        <h1 className={styles.title}>{keepHyphenatedWords(guide.title)}</h1>
      )}

      <figure className={styles.demo} aria-labelledby="guide-demo-label">
        <p id="guide-demo-label" className={styles.demoLabel}>
          <span className={styles.demoDot} aria-hidden="true" />
          Exact movement Fitr checks
        </p>
        <div className={styles.demoFrame}>
          <GuideDemo
            exercise={exercise}
            clip={clip}
            label={`Demonstration of ${exerciseName} with correct form`}
          />
        </div>
        {available.length > 1 && (
          <div className={styles.toggle} role="radiogroup" aria-label="Demonstrator">
            {available.map((d) => (
              <button
                key={d.value}
                type="button"
                role="radio"
                aria-checked={demonstrator === d.value}
                className={styles.toggleButton}
                onClick={() => setDemonstrator(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
        <figcaption className={styles.caption}>
          {clip ? (
            <>
              Demo video by{" "}
              <a href={clip.credit.url} target="_blank" rel="noopener noreferrer">
                {clip.credit.author}
              </a>{" "}
              on {clip.credit.provider}
            </>
          ) : (
            <>The green joint lights up when you hit the standard.</>
          )}
        </figcaption>
      </figure>

      <section className={screen.card} aria-labelledby="guide-cues-heading">
        <h2 id="guide-cues-heading" className={screen.cardTitle}>
          Key points
        </h2>
        <ul className={styles.cues}>
          {guide.cues.map((cue) => (
            <li key={cue} className={styles.cue}>
              <span className={styles.cueIcon} aria-hidden="true">
                <CheckIcon size={18} />
              </span>
              <p>{cue}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={screen.card} aria-labelledby="guide-placement-heading">
        <h2 id="guide-placement-heading" className={screen.cardTitle}>
          Where to put your phone
        </h2>
        <PhonePlacement exercise={exercise} layout={guide.placement.layout} distance={guide.placement.distance} />
        <p className={screen.cardText}>{guide.placement.caption}</p>
      </section>

      <label className={styles.dontShow}>
        <input
          type="checkbox"
          checked={dontShow}
          onChange={(e) => setDontShow(e.target.checked)}
          className={styles.checkbox}
        />
        <span>Don&apos;t show this before {exerciseName} again</span>
      </label>

      <div className={screen.stickyActions}>
        <button type="button" className={screen.ctaButton} onClick={handleContinue}>
          <span className={screen.ctaLabel}>Got it, continue</span>
          <span className={screen.ctaCap} aria-hidden="true">
            <PlayIcon size={22} />
          </span>
        </button>
      </div>
    </div>
  );
}
