import Button from "@/components/ui/Button";
import { CheckIcon } from "@/components/icons/Icons";
import { STANDING_ART, exerciseArt } from "@/lib/exerciseArt";
import { EXERCISE_LIST } from "@/lib/exercises";
import { DownloadIcon } from "./LandingIcons";
import PhoneMock from "./PhoneMock";
import { APK_NOTE, LANDING_LINKS } from "./links";
import section from "./section.module.css";
import styles from "./Hero.module.css";

/** Hero: the promise, the two ways in, and a phone mid-workout in front of the athlete. */
export default function Hero() {
  const pushup = exerciseArt("pushup");
  return (
    <section id="top" className={styles.hero} aria-labelledby="landing-title">
      <div className={`${section.container} ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden="true" />
            A fitness commitment app for Solana Seeker
          </p>
          <h1 id="landing-title" className={styles.title}>
            Put your word <span className={styles.accent}>on the line.</span>
          </h1>
          <p className={styles.lede}>
            Pick a daily goal, stake your own SKR on showing up, and let the AI on your phone count
            every rep. Do the work and your stake comes back with a share of what the no-shows left
            behind. Skip it and it goes to the people who did.
          </p>
          <div className={styles.ctas}>
            <div className={styles.download}>
              <Button
                variant="primary"
                size="lg"
                href={LANDING_LINKS.apk}
                prefetch={false}
                icon={<DownloadIcon size={20} strokeWidth={2.25} />}
                className={styles.primaryCta}
              >
                Download for Android
              </Button>
              <p className={styles.note}>{APK_NOTE}</p>
            </div>
            <Button variant="secondary" size="lg" href={LANDING_LINKS.app} prefetch={false} className={styles.secondaryCta}>
              Open in browser
            </Button>
          </div>
          <ul className={styles.facts} role="list">
            <li>
              <CheckIcon size={16} strokeWidth={2.5} /> {EXERCISE_LIST.length} bodyweight exercises
            </li>
            <li>
              <CheckIcon size={16} strokeWidth={2.5} /> Video never leaves your phone
            </li>
            <li>
              <CheckIcon size={16} strokeWidth={2.5} /> Workouts free for everyone
            </li>
          </ul>
        </div>

        <div className={styles.stage}>
          <div className={styles.halo} aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static art (see ArtPhoto) */}
          <img
            className={styles.athlete}
            src={STANDING_ART.src}
            srcSet={`${STANDING_ART.thumb} 420w, ${STANDING_ART.src} 960w`}
            sizes="(min-width: 900px) 560px, 100vw"
            width={960}
            height={960}
            alt={STANDING_ART.alt}
            fetchPriority="high"
            decoding="async"
            draggable={false}
          />
          {pushup ? <PhoneMock art={pushup} className={styles.phone} /> : null}

          <div className={`${styles.float} ${styles.floatTop}`} aria-hidden="true">
            <span className={styles.floatIcon}>
              <CheckIcon size={16} strokeWidth={2.75} />
            </span>
            <span>
              <span className={styles.floatLabel}>Day verified</span>
              <span className={styles.floatValue}>On-chain</span>
            </span>
          </div>
          <div className={`${styles.float} ${styles.floatBottom}`} aria-hidden="true">
            <span className={styles.floatLabel}>Settled</span>
            <span className={styles.floatValue}>
              100 <span className={styles.floatPlus}>+40.7</span> SKR
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
