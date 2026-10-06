import { Wordmark } from "@/components/brand/Brand";
import { LANDING_LINKS } from "./links";
import MobileMenu from "./MobileMenu";
import section from "./section.module.css";
import styles from "./LandingNav.module.css";

const ANCHORS = [
  { hash: "#how", label: "How it works" },
  { hash: "#workouts", label: "Workouts" },
  { hash: "#trust", label: "Trust" },
  { hash: "#seeker", label: "Seeker" },
  { hash: "#install", label: "Install" },
] as const;

export interface LandingNavProps {
  /**
   * True on the landing page itself (links are in-page anchors). On the info pages
   * (verification, privacy, credits) they point back to the landing page on fitr.day.
   */
  onHome?: boolean;
}

/** Sticky top bar: wordmark on the left; section anchors on the right (desktop) or a ☰ menu (phones). */
export default function LandingNav({ onHome = true }: LandingNavProps) {
  const base = onHome ? "" : LANDING_LINKS.home;
  return (
    <header className={styles.bar}>
      <div className={`${section.container} ${styles.inner}`}>
        <a href={onHome ? "#top" : LANDING_LINKS.home} className={styles.brand} aria-label={onHome ? "Fitr, back to top" : "Fitr home"}>
          <Wordmark height={30} alt="" />
        </a>
        <nav aria-label="Sections" className={styles.anchors}>
          <ul role="list">
            {ANCHORS.map((a) => (
              <li key={a.hash}>
                <a href={`${base}${a.hash}`}>{a.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <MobileMenu links={ANCHORS.map((a) => ({ href: `${base}${a.hash}`, label: a.label }))} />
      </div>
    </header>
  );
}
