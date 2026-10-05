import Button from "@/components/ui/Button";
import { CheckIcon } from "@/components/icons/Icons";
import { STANDING_ART, exerciseArt } from "@/lib/exerciseArt";
import { EXERCISE_LIST } from "@/lib/exercises";
import { DownloadIcon } from "./LandingIcons";
import HeroStage from "./HeroStage";
import PhoneMock from "./PhoneMock";
import { APK_NOTE, LANDING_LINKS } from "./links";
import section from "./section.module.css";
import styles from "./Hero.module.css";
import { SkrLogo } from "@/components/brand/SkrAmount";
import { BrandMark } from "@/components/brand/Brand";

/** The Solana logomark, in its official gradient. */
function SolanaMark() {
  return (
    <svg className={styles.solana} viewBox="0 0 398 312" aria-hidden="true">
      <defs>
        <linearGradient id="hero-solana" x1="0" y1="312" x2="398" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9945FF" />
          <stop offset="1" stopColor="#14F195" />
        </linearGradient>
      </defs>
      <g fill="url(#hero-solana)">
        <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
        <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
        <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" />
      </g>
    </svg>
  );
}

/** Hero: the promise, the Android download, and a phone mid-workout in front of the athlete. */
export default function Hero() {
  const pushup = exerciseArt("pushup");
  return (
    <section id="top" className={styles.hero} aria-labelledby="landing-title">
      <div className={`${section.container} ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={styles.tag}>
            <span className={styles.tagMark} aria-hidden="true">
              <BrandMark size={16} />
            </span>
            <span className={styles.tagBody}>
              <span className={styles.tagTitle}>Fitness commitment app</span>
              <span className={styles.tagMeta}>
                <SolanaMark />
                Built for Solana Seeker
              </span>
            </span>
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
            <Button variant="secondary" size="lg" href="#install" prefetch={false} className={styles.secondaryCta}>
              How to install
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

        <HeroStage className={styles.stage}>
          <div className={styles.halo} aria-hidden="true" />
          <div className={styles.athlete}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static art (see ArtPhoto) */}
            <img
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
            <span className={styles.sweep} aria-hidden="true" />
          </div>
          <div className={styles.pedestal} aria-hidden="true">
            <span className={styles.ringOuter} />
            <span className={styles.ringInner}>
              <span className={styles.ringDot} />
            </span>
          </div>
          {pushup ? <PhoneMock art={pushup} className={styles.phone} /> : null}

          <div className={`${styles.float} ${styles.floatTop}`} aria-hidden="true">
            <span className={styles.floatIcon}>
              <span className={styles.ping} />
              <CheckIcon size={16} strokeWidth={2.75} />
            </span>
            <span>
              <span className={styles.floatLabel}>Day verified</span>
              <span className={styles.floatValue}>Onchain</span>
            </span>
          </div>
          <div className={`${styles.float} ${styles.floatBottom}`} aria-hidden="true">
            <span className={styles.floatLabel}>Settled</span>
            <span className={styles.floatValue}>
              100 <span className={styles.floatPlus}>+40.7</span> <SkrLogo />
            </span>
          </div>
        </HeroStage>
      </div>
    </section>
  );
}
