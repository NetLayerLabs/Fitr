import { DownloadIcon } from "@/components/landing/LandingIcons";
import { APK_URL } from "@/lib/actions/links";
import styles from "./Public.module.css";

export interface JoinCtaProps {
  title: string;
  text: string;
  /** dial.to link to the "Commit with me" Blink; omitted while the vault is not open. */
  blinkUrl?: string | null;
  blinkLabel?: string;
}

/** Lime band: download the APK, and (when the vault is live) commit straight from a wallet. */
export default function JoinCta({ title, text, blinkUrl, blinkLabel = "Commit with me" }: JoinCtaProps) {
  return (
    <section className={styles.cta} aria-labelledby="join-title" data-lime-moment="">
      <div>
        <h2 id="join-title" className={styles.ctaTitle}>
          {title}
        </h2>
        <p className={styles.ctaText}>{text}</p>
      </div>
      <div className={styles.ctaActions}>
        <a className={styles.ctaButton} href={APK_URL}>
          <DownloadIcon size={20} strokeWidth={2.25} aria-hidden="true" />
          Download Fitr for Seeker
        </a>
        {blinkUrl ? (
          <a className={styles.ctaButtonAlt} href={blinkUrl} target="_blank" rel="noopener noreferrer">
            {blinkLabel}
          </a>
        ) : null}
        <p className={styles.ctaNote}>Android APK · staking is Seeker-only</p>
      </div>
    </section>
  );
}
