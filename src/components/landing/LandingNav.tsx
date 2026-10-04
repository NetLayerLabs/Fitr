import { Wordmark } from "@/components/brand/Brand";
import { ArrowUpRightIcon } from "./LandingIcons";
import { LANDING_LINKS } from "./links";
import section from "./section.module.css";
import styles from "./LandingNav.module.css";

const ANCHORS = [
  { href: "#how", label: "How it works" },
  { href: "#workouts", label: "Workouts" },
  { href: "#trust", label: "Trust" },
  { href: "#seeker", label: "Seeker" },
] as const;

/** Sticky top bar: wordmark, in-page anchors (desktop) and the "Open app" pill. */
export default function LandingNav() {
  return (
    <header className={styles.bar}>
      <div className={`${section.container} ${styles.inner}`}>
        <a href="#top" className={styles.brand} aria-label="Fitr, back to top">
          <Wordmark height={30} alt="" />
        </a>
        <nav aria-label="Sections" className={styles.anchors}>
          <ul role="list">
            {ANCHORS.map((a) => (
              <li key={a.href}>
                <a href={a.href}>{a.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <a href={LANDING_LINKS.app} className={styles.open}>
          Open app
          <ArrowUpRightIcon size={16} strokeWidth={2.25} />
        </a>
      </div>
    </header>
  );
}
