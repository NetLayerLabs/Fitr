import { Wordmark } from "@/components/brand/Brand";
import { LANDING_LINKS } from "./links";
import section from "./section.module.css";
import styles from "./LandingFooter.module.css";

const LINKS = [
  { href: LANDING_LINKS.app, label: "Open app" },
  { href: LANDING_LINKS.apk, label: "Android APK" },
  { href: LANDING_LINKS.verification, label: "Verification" },
  { href: LANDING_LINKS.privacy, label: "Privacy" },
  { href: LANDING_LINKS.credits, label: "Credits" },
] as const;

export default function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={`${section.container} ${styles.inner}`}>
        <div className={styles.brand}>
          <div>
            <Wordmark height={30} />
            <p className={styles.tag}>Put your word on the line.</p>
          </div>
        </div>
        <nav aria-label="Footer">
          <ul className={styles.links} role="list">
            {LINKS.map((l) => (
              <li key={l.label}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className={`${section.container} ${styles.legal}`}>
        <p>© {year} Fitr</p>
        <p>
          A commitment app, not an investment. Stakes are in SKR on Solana mainnet and can be lost if
          you miss your goal.
        </p>
      </div>
    </footer>
  );
}
