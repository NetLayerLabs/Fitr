import Button from "@/components/ui/Button";
import { DownloadIcon } from "./LandingIcons";
import { APK_NOTE, LANDING_LINKS } from "./links";
import section from "./section.module.css";
import styles from "./FinalCta.module.css";

/** Full-bleed lime "moment": black ink on lime, the last push to commit. */
export default function FinalCta() {
  return (
    <section className={styles.band} aria-labelledby="cta-title" data-lime-moment="">
      <div className={`${section.container} ${styles.inner}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Tomorrow starts today</p>
          <h2 id="cta-title" className={styles.title}>
            Show up. Every day. On the record.
          </h2>
          <p className={styles.lede}>
            Set your first goal in a minute. Train free on any phone, and stake when you&apos;re ready
            to mean it.
          </p>
        </div>
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            href={LANDING_LINKS.apk}
            prefetch={false}
            icon={<DownloadIcon size={20} strokeWidth={2.25} />}
            block
          >
            Download for Android
          </Button>
          <Button variant="secondary" size="lg" href={LANDING_LINKS.app} prefetch={false} block>
            Open in browser
          </Button>
          <p className={styles.note}>{APK_NOTE}</p>
        </div>
      </div>
    </section>
  );
}
