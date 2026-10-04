import Button from "@/components/ui/Button";
import InstallGuide from "./InstallGuide";
import { DownloadIcon } from "./LandingIcons";
import { APK_NOTE, LANDING_LINKS } from "./links";
import section from "./section.module.css";
import styles from "./FinalCta.module.css";

/** Full-bleed lime "moment": black ink on lime, the download and how to install it. */
export default function FinalCta() {
  return (
    <section id="install" className={styles.band} aria-labelledby="cta-title" data-lime-moment="">
      <div className={`${section.container} ${styles.inner}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Tomorrow starts today</p>
          <h2 id="cta-title" className={styles.title}>
            Show up. Every day. On the record.
          </h2>
          <p className={styles.lede}>
            Fitr is an Android app. Train free on any Android phone, and stake on your Seeker when
            you&apos;re ready to mean it.
          </p>
        </div>
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            href={LANDING_LINKS.apk}
            prefetch={false}
            icon={<DownloadIcon size={20} strokeWidth={2.25} />}
            className={styles.cta}
            block
          >
            Download for Android
          </Button>
          <p className={styles.note}>{APK_NOTE}</p>
          <InstallGuide />
        </div>
      </div>
    </section>
  );
}
